import { useEffect, useMemo, useRef, useState } from 'react';
import useRefreshOnResume from '../hooks/useRefreshOnResume.js';
import BoundedDatePicker from '../components/BoundedDatePicker.jsx';
import { getAccounts } from '../services/accountService.js';
import { getCategories } from '../services/categoryService.js';
import { findSmartMatch } from '../services/matchingService.js';
import { getProjectTags } from '../services/projectTagService.js';
import { getCurrentUserProfile } from '../services/userProfileService.js';
import { parseStatementFile } from '../services/statementParserService.js';
import {
  bulkUpdateImportedTransactions,
  createStatementImport,
  deleteStatementImportFile,
  findDuplicateStatementImport,
  getImportedTransactions,
  IMPORTED_TRANSACTION_REVIEW_PAGE_SIZE,
  getStatementImports,
  saveImportedTransactions,
  updateImportedTransaction,
  updateImportedTransactionStatus
} from '../services/statementImportService.js';
import { createTransaction } from '../services/transactionService.js';
import { linkDuePayment } from '../services/upcomingDueService.js';
import { getCategoryOptions } from '../utils/categoryOptions.js';
import { earliestHistoricalDate, getLocalIsoDate } from '../utils/dateBounds.js';
import { formatCurrency } from '../utils/format.js';
import { resolveMoneyDirection } from '../utils/transactionDirection.js';
import { classifyCreditStatementRow } from '../utils/creditFacility.js';

const today = getLocalIsoDate();

const allowedExtensions = ['pdf', 'csv', 'xls', 'xlsx'];
const activeStatuses = new Set(['pending', 'needs_review']);
const processedStatuses = new Set(['imported', 'ignored', 'duplicate']);
const emptyReviewSummary = {
  count: 0,
  linkedRows: 0,
  rowsNeedingReview: 0,
  totalExpense: 0,
  totalIncome: 0
};
const reviewFilters = [
  { id: 'all', label: 'All' },
  { id: 'income', label: 'Income' },
  { id: 'expense', label: 'Expense' },
  { id: 'transfer-in', label: 'Transfer In' },
  { id: 'transfer-out', label: 'Transfer Out' },
  { id: 'needs-review', label: 'Need Review' },
  { id: 'linked', label: 'Linked' }
];
const importSuggestionRules = [
  {
    category: ['Subscription', 'Media Streaming'],
    keywords: ['netflix', 'disney+', 'disney plus', 'vidio', 'spotify', 'apple music', 'youtube premium'],
    projectTag: 'Subscription'
  },
  {
    category: ['Subscription', 'Cloud Storage'],
    keywords: ['icloud', 'google storage', 'google one', 'google cloud storage', 'google drive', 'dropbox', 'onedrive', 'one drive'],
    projectTag: 'Subscription'
  },
  {
    category: ['Subscription', 'Apps & Software'],
    keywords: ['chatgpt', 'openai', 'claude', 'anthropic', 'adobe', 'creative cloud', 'canva', 'figma', 'microsoft 365', 'office 365'],
    projectTag: 'Subscription'
  },
  {
    category: ['Liability', 'Credit Card Payment'],
    keywords: ['credit card payment', 'kartu kredit', 'card payment', 'cc payment', 'visa payment', 'mastercard payment'],
    projectTag: null
  },
  {
    category: ['Liability', 'Loan Payment'],
    keywords: ['loan payment', 'cicilan', 'angsuran', 'pinjaman', 'mortgage', 'kpr', 'paylater', 'pay later'],
    projectTag: null
  }
];
const categoryParentAliases = {
  Liability: ['Debt']
};

function getFileType(file) {
  return file.name.split('.').pop()?.toLowerCase() || '';
}

function isRowImportable(row) {
  if (!row.amount || !row.transaction_date || !row.transaction_type) {
    return false;
  }

  if (row.transaction_type === 'transfer') {
    return Boolean(row.from_account_id && row.to_account_id);
  }

  return Boolean(row.account_id && row.category_id);
}

function formatRetentionDate(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

function getFileRetentionText(item) {
  if (item.file_deleted_at) {
    return 'File expired - imported data retained';
  }

  if (item.file_retention_expires_at) {
    return `File kept until ${formatRetentionDate(item.file_retention_expires_at)}`;
  }

  return '';
}

function normalizeSuggestionText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim();
}

export default function StatementImportPage() {
  const [imports, setImports] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeImport, setActiveImport] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projectTags, setProjectTags] = useState([]);
  const [file, setFile] = useState(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [pendingSourceAccountId, setPendingSourceAccountId] = useState('');
  const [draggingFile, setDraggingFile] = useState(false);
  const [fileSelectionMissing, setFileSelectionMissing] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [defaultAccountId, setDefaultAccountId] = useState('');
  const [importSort, setImportSort] = useState('latest');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewTotalCount, setReviewTotalCount] = useState(0);
  const [reviewSummary, setReviewSummary] = useState(emptyReviewSummary);
  const [loadingMoreRows, setLoadingMoreRows] = useState(false);
  const [bulkValues, setBulkValues] = useState({
    account_id: '',
    category_id: '',
    project_tag_id: ''
  });
  const [editingIds, setEditingIds] = useState(new Set());
  const [rawVisibleIds, setRawVisibleIds] = useState(new Set());
  const [pendingMatch, setPendingMatch] = useState(null);
  const [reviewCollapsed, setReviewCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);
  const allCategoryOptions = useMemo(() => getCategoryOptions(categories, null), [categories]);
  const getRowCategoryOptions = (row) => (
    getCategoryOptions(categories, row.transaction_type === 'transfer' ? null : row.transaction_type)
  );
  const sourceAccounts = useMemo(() => (
    accounts.filter((account) => ['Bank', 'E-Wallet', 'Credit Card', 'PayLater'].includes(account.type))
  ), [accounts]);
  const sourceOptions = useMemo(() => (
    [...new Set([...sourceAccounts.map((account) => account.name), 'Generic PDF'])]
  ), [sourceAccounts]);
  const defaultAccount = useMemo(() => (
    accounts.find((account) => account.id === defaultAccountId) || null
  ), [accounts, defaultAccountId]);
  const showReviewQueue = Boolean(activeImport && !file);

  const sortedImports = useMemo(() => (
    [...imports].sort((first, second) => {
      const firstTime = new Date(first.created_at || 0).getTime();
      const secondTime = new Date(second.created_at || 0).getTime();
      return importSort === 'oldest' ? firstTime - secondTime : secondTime - firstTime;
    })
  ), [importSort, imports]);

  const activeRows = useMemo(() => (
    previewRows.filter((row) => activeStatuses.has(row.import_status))
  ), [previewRows]);

  const filteredRows = previewRows;

  const filteredActiveRows = useMemo(() => (
    filteredRows.filter((row) => activeStatuses.has(row.import_status))
  ), [filteredRows]);

  const selectedRows = useMemo(() => (
    activeRows.filter((row) => selectedIds.has(row.id))
  ), [activeRows, selectedIds]);

  const processedRows = useMemo(() => (
    previewRows.filter((row) => processedStatuses.has(row.import_status))
  ), [previewRows]);

  const summary = useMemo(() => ({
    ...reviewSummary,
    netAmount: reviewSummary.totalIncome - reviewSummary.totalExpense
  }), [reviewSummary]);

  async function loadImports(background = false) {
    setError('');
    if (!background) setLoading(true);

    try {
      const [importData, accountData, categoryData, projectTagData, profileData] = await Promise.all([
        getStatementImports(),
        getAccounts(),
        getCategories(),
        getProjectTags(),
        getCurrentUserProfile()
      ]);
      setImports(importData);
      setAccounts(accountData);
      setCategories(categoryData);
      setProjectTags(projectTagData);
      setDefaultAccountId(profileData?.default_account_id || '');
    } catch (err) {
      setError(err.message || 'Unable to load imports.');
    } finally {
      if (!background) setLoading(false);
    }
  }

  useEffect(() => {
    loadImports();
  }, []);

  useRefreshOnResume(() => loadImports(true));

  useEffect(() => {
    if (!success) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setSuccess(''), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [success]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!sourceName) {
      setSourceName(defaultAccount?.name || sourceOptions[0] || 'Generic PDF');
      return;
    }

    if (!sourceOptions.includes(sourceName)) {
      setSourceName(defaultAccount?.name || sourceOptions[0] || 'Generic PDF');
    }
  }, [defaultAccount?.name, loading, sourceName, sourceOptions]);

  useEffect(() => {
    if (!activeImport) {
      return;
    }

    loadReviewRows(activeImport).catch((err) => {
      setError(err.message || 'Unable to filter import preview.');
    });
  }, [reviewFilter, reviewSearch]);

  function selectStatementFile(selectedFile, resetInput) {
    if (!selectedFile) {
      setFile(null);
      return;
    }

    const fileType = getFileType(selectedFile);

    if (!allowedExtensions.includes(fileType)) {
      setError('Only PDF, CSV, and XLSX statement files are supported.');
      setFile(null);
      if (resetInput) {
        resetInput();
      }
      return;
    }

    setError('');
    setFileSelectionMissing(false);
    setIsSourceModalOpen(false);
    setPendingSourceAccountId('');
    setFile(selectedFile);
  }

  function handleFileChange(event) {
    selectStatementFile(event.target.files?.[0] || null, () => {
      event.target.value = '';
    });
  }

  function handleFileDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDraggingFile(true);
  }

  function handleFileDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDraggingFile(false);
    }
  }

  function handleFileDrop(event) {
    event.preventDefault();
    setDraggingFile(false);
    selectStatementFile(event.dataTransfer.files?.[0] || null);
  }

  function clearSelectedStatementFile() {
    setFile(null);
    setIsSourceModalOpen(false);
    setPendingSourceAccountId('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function closeSourceAccountModal() {
    setIsSourceModalOpen(false);
    setPendingSourceAccountId('');
    setError('');
  }

  function handleUploadReview(event) {
    event.preventDefault();

    if (!file) {
      setError('');
      setFileSelectionMissing(true);
      return;
    }

    setError('');
    setPendingSourceAccountId('');
    setIsSourceModalOpen(true);
  }

  function updateRowLocal(rowId, field, value) {
    setPreviewRows((currentRows) => currentRows.map((row) => (
      row.id === rowId ? normalizeRowLocalChange(row, field, value) : row
    )));
  }

  function normalizeRowLocalChange(row, field, value) {
    const nextRow = { ...row, [field]: value };

    if (field === 'transaction_type' && value !== 'transfer') {
      nextRow.money_direction = resolveMoneyDirection(nextRow);
    }

    if (field === 'transaction_type' && value === 'transfer') {
      nextRow.category_id = '';

      if (nextRow.money_direction === 'out' && nextRow.account_id && !nextRow.from_account_id) {
        nextRow.from_account_id = nextRow.account_id;
      }

      if (nextRow.money_direction === 'in' && nextRow.account_id && !nextRow.to_account_id) {
        nextRow.to_account_id = nextRow.account_id;
      }
    }

    if (field === 'account_id' && nextRow.transaction_type === 'transfer') {
      if (nextRow.money_direction === 'out') {
        nextRow.from_account_id = value;
      } else if (nextRow.money_direction === 'in') {
        nextRow.to_account_id = value;
      }
    }

    return nextRow;
  }

  function setRowStatus(rowId, importStatus) {
    setPreviewRows((currentRows) => currentRows.map((row) => (
      row.id === rowId ? { ...row, import_status: importStatus } : row
    )));
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(rowId);
      return nextIds;
    });
  }

  function toggleRow(rowId) {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(rowId)) {
        nextIds.delete(rowId);
      } else {
        nextIds.add(rowId);
      }

      return nextIds;
    });
  }

  function toggleEdit(rowId) {
    setEditingIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(rowId)) {
        nextIds.delete(rowId);
      } else {
        nextIds.add(rowId);
      }

      return nextIds;
    });
  }

  function toggleRaw(rowId) {
    setRawVisibleIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(rowId)) {
        nextIds.delete(rowId);
      } else {
        nextIds.add(rowId);
      }

      return nextIds;
    });
  }

  function selectRows(rows) {
    setSelectedIds(new Set(rows.map((row) => row.id)));
  }

  function findCategoryByPath(parentName, childName) {
    const parentNames = [parentName, ...(categoryParentAliases[parentName] || [])];
    const parent = categories.find((category) => (
      !category.parent_category_id
      && category.type === 'expense'
      && parentNames.some((name) => category.name.toLowerCase() === name.toLowerCase())
    ));

    if (!parent) {
      return null;
    }

    return categories.find((category) => (
      category.parent_category_id === parent.id
      && category.type === 'expense'
      && category.name.toLowerCase() === childName.toLowerCase()
    )) || parent;
  }

  function findProjectTagByName(name) {
    if (!name) {
      return null;
    }

    return projectTags.find((tag) => tag.name.toLowerCase() === name.toLowerCase()) || null;
  }

  function getImportSuggestions(row) {
    if (row.transaction_type !== 'expense') {
      return {};
    }

    const description = normalizeSuggestionText([
      row.raw_description,
      row.clean_description,
      row.description
    ].filter(Boolean).join(' '));
    const rule = importSuggestionRules.find((item) => (
      item.keywords.some((keyword) => description.includes(normalizeSuggestionText(keyword)))
    ));

    if (!rule) {
      return {};
    }

    const [parentName, childName] = rule.category;
    const category = findCategoryByPath(parentName, childName);
    const projectTag = findProjectTagByName(rule.projectTag);

    return {
      category_id: category?.id || null,
      project_tag_id: projectTag?.id || null
    };
  }

  function getRowsWithSourceAccount(rows, importSource = sourceName) {
    const sourceAccount = typeof importSource === 'object'
      ? importSource
      : sourceAccounts.find((account) => account.name === importSource);
    const fallbackAccount = sourceAccount || defaultAccount;

    return rows.map((row) => {
      const classifiedRow = classifyCreditStatementRow(row, sourceAccount);
      const suggestions = getImportSuggestions(classifiedRow);

      return {
        ...classifiedRow,
        account_id: classifiedRow.account_id || fallbackAccount?.id || null,
        category_id: classifiedRow.category_id || suggestions.category_id || null,
        project_tag_id: classifiedRow.project_tag_id || suggestions.project_tag_id || null
      };
    });
  }

  async function loadReviewRows(statementImport, { append = false } = {}) {
    if (!statementImport?.id) {
      return;
    }

    const offset = append ? previewRows.length : 0;
    const result = await getImportedTransactions(statementImport.id, {
      filter: reviewFilter,
      offset,
      pageSize: IMPORTED_TRANSACTION_REVIEW_PAGE_SIZE,
      search: reviewSearch
    });

    setPreviewRows((currentRows) => (append ? [...currentRows, ...result.rows] : result.rows));
    setReviewTotalCount(result.count);
    setReviewSummary(result.summary || emptyReviewSummary);

    if (!append) {
      setSelectedIds(new Set());
    }
  }

  async function openImportPreview(statementImport) {
    setError('');

    try {
      setActiveImport(statementImport);
      setReviewCollapsed(false);
      await loadReviewRows(statementImport);
    } catch (err) {
      setError(err.message || 'Unable to open import preview.');
    }
  }

  async function reparseImport(statementImport) {
    if (!statementImport?.file_url || statementImport.file_deleted_at) {
      setError('The original statement file is no longer available. Upload the file again to parse it.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const response = await fetch(statementImport.file_url);

      if (!response.ok) {
        throw new Error('Unable to download the original statement file for re-parsing.');
      }

      const blob = await response.blob();
      const statementFile = new File([blob], statementImport.file_name, {
        type: blob.type || 'application/octet-stream'
      });
      const rows = await parseStatementFile(statementFile, statementImport.bank_name || sourceName || 'Generic PDF');

      if (rows.length === 0) {
        throw new Error('No transaction rows were found in this statement. Check that the file contains dated debit/credit rows.');
      }

      await saveImportedTransactions(statementImport.id, getRowsWithSourceAccount(rows, statementImport.bank_name));

      setActiveImport(statementImport);
      setReviewCollapsed(false);
      await loadReviewRows(statementImport);
      await loadImports();
    } catch (err) {
      setError(err.message || 'Unable to re-parse this statement.');
    } finally {
      setSaving(false);
    }
  }

  async function processStatementFile(statementFile, sourceAccount) {
    const importSourceName = sourceAccount.name;

    setError('');
    setSaving(true);

    try {
      const duplicate = await findDuplicateStatementImport(statementFile, importSourceName);

      if (duplicate.existing) {
        const uploadedAt = duplicate.existing.created_at
          ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(duplicate.existing.created_at))
          : 'an earlier upload';
        const shouldContinue = window.confirm(
          `Possible duplicate file found\n\nExisting file: ${duplicate.existing.file_name}\nUploaded: ${uploadedAt}\n\nCancel upload or choose OK to upload anyway.`
        );

        if (!shouldContinue) {
          closeSourceAccountModal();
          return;
        }
      }

      const rows = await parseStatementFile(statementFile, importSourceName);

      if (rows.length === 0) {
        throw new Error('No transaction rows were found in this statement. Check that the file contains dated debit/credit rows.');
      }

      const statementImport = await createStatementImport(statementFile, importSourceName, {
        fileHash: duplicate.fileHash
      });
      const rowsWithSourceAccount = getRowsWithSourceAccount(rows, sourceAccount);
      await saveImportedTransactions(statementImport.id, rowsWithSourceAccount);

      clearSelectedStatementFile();
      setActiveImport(statementImport);
      setReviewCollapsed(false);
      await loadReviewRows(statementImport);
      await loadImports();
    } catch (err) {
      setError(err.message || 'Unable to upload and parse statement.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmSourceAccount() {
    const sourceAccount = sourceAccounts.find((account) => account.id === pendingSourceAccountId);

    if (!file || !sourceAccount) {
      setError('Select the source account for this statement.');
      return;
    }

    setSourceName(sourceAccount.name);
    await processStatementFile(file, sourceAccount);
  }

  async function handleDeleteImportFile(item) {
    const confirmed = window.confirm(
      `Delete "${item.file_name}" now?\n\nThe source file and all unimported review rows will be removed. Transactions already imported and report data will remain.`
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setSaving(true);

    try {
      const deletedImportId = await deleteStatementImportFile(item);
      setImports((currentImports) => currentImports.filter((currentItem) => (
        currentItem.id !== deletedImportId
      )));

      if (activeImport?.id === deletedImportId) {
        setActiveImport(null);
        setReviewCollapsed(false);
        setPreviewRows([]);
        setReviewTotalCount(0);
        setReviewSummary(emptyReviewSummary);
        setSelectedIds(new Set());
      }
    } catch (err) {
      setError(err.message || 'Unable to delete uploaded file.');
    } finally {
      setSaving(false);
    }
  }

  async function applyBulkField(field, value) {
    if (!value) {
      return;
    }

    if (selectedRows.length === 0) {
      setError('Select one or more rows before applying bulk values.');
      return;
    }

    setError('');
    const ids = selectedRows.map((row) => row.id);
    setPreviewRows((currentRows) => currentRows.map((row) => (
      ids.includes(row.id) ? { ...row, [field]: value } : row
    )));
    await bulkUpdateImportedTransactions(ids, { [field]: value });
    setBulkValues((currentValues) => ({
      ...currentValues,
      [field]: value
    }));
  }

  async function saveRow(row) {
    setError('');

    try {
      const importStatus = isRowImportable(row) && row.import_status === 'needs_review'
        ? 'pending'
        : row.import_status;
      const updatedRow = await updateImportedTransaction(row.id, {
        ...row,
        import_status: importStatus
      });
      setPreviewRows((currentRows) => currentRows.map((currentRow) => (
        currentRow.id === row.id ? updatedRow : currentRow
      )));
      toggleEdit(row.id);
    } catch (err) {
      setError(err.message || 'Unable to save row.');
    }
  }

  async function saveInlineRow(rowId) {
    const row = previewRows.find((currentRow) => currentRow.id === rowId);

    if (!row) {
      return;
    }

    try {
      const importStatus = isRowImportable(row) && row.import_status === 'needs_review'
        ? 'pending'
        : row.import_status;
      const updatedRow = await updateImportedTransaction(row.id, {
        ...row,
        import_status: importStatus
      });
      setPreviewRows((currentRows) => currentRows.map((currentRow) => (
        currentRow.id === row.id ? updatedRow : currentRow
      )));
    } catch (err) {
      setError(err.message || 'Unable to save row changes.');
    }
  }

  function blurOnEnter(event) {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  }

  async function ignoreRow(row) {
    await updateImportedTransactionStatus(row.id, 'ignored');
    setRowStatus(row.id, 'ignored');
  }

  async function ignoreSelectedRows() {
    if (selectedRows.length === 0) {
      setError('Select one or more rows to ignore.');
      return;
    }

    const confirmed = window.confirm(
      `Ignore ${selectedRows.length} selected row${selectedRows.length === 1 ? '' : 's'}?\n\nIgnored rows will not be added to Activity.`
    );

    if (!confirmed) {
      return;
    }

    const selectedIdList = selectedRows.map((row) => row.id);
    setError('');
    setSaving(true);

    try {
      await bulkUpdateImportedTransactions(selectedIdList, { import_status: 'ignored' });
      setPreviewRows((currentRows) => currentRows.map((row) => (
        selectedIdList.includes(row.id) ? { ...row, import_status: 'ignored' } : row
      )));
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.message || 'Unable to ignore selected rows.');
    } finally {
      setSaving(false);
    }
  }

  async function createTransactionFromImportedRow(row) {
    const moneyDirection = resolveMoneyDirection(row);
    const sourceAccountId = row.account_id || defaultAccountId || null;
    const transaction = await createTransaction({
      account_id: sourceAccountId,
      from_account_id: row.transaction_type === 'transfer'
        ? row.from_account_id || (row.money_direction === 'out' ? sourceAccountId : null)
        : null,
      to_account_id: row.transaction_type === 'transfer'
        ? row.to_account_id || (row.money_direction === 'in' ? sourceAccountId : null)
        : null,
      category_id: row.category_id,
      project_tag_id: row.project_tag_id,
      imported_transaction_id: row.id,
      transaction_type: row.transaction_type,
      amount: Math.abs(Number(row.amount || 0)),
      description: row.clean_description || row.description,
      transaction_date: row.transaction_date,
      transfer_fee: row.transfer_fee || 0,
      transfer_purpose: row.transfer_purpose || '',
      money_direction: moneyDirection,
      financial_activity: row.financial_activity || 'standard',
      notes: row.notes || (activeImport ? `Imported from ${activeImport.file_name}` : 'Imported from statement')
    });

    await updateImportedTransactionStatus(row.id, 'imported', transaction.id);
    setRowStatus(row.id, 'imported');
    return transaction;
  }

  async function refreshPreview() {
    if (!activeImport) {
      return;
    }

    await loadReviewRows(activeImport);
    setSelectedIds(new Set());
    await loadImports();
  }

  async function loadMoreReviewRows() {
    if (!activeImport || loadingMoreRows) {
      return;
    }

    setLoadingMoreRows(true);
    setError('');

    try {
      await loadReviewRows(activeImport, { append: true });
    } catch (err) {
      setError(err.message || 'Unable to load more rows.');
    } finally {
      setLoadingMoreRows(false);
    }
  }

  async function processImportRowQueue(rows) {
    if (rows.length === 0) {
      await refreshPreview();
      return;
    }

    const [row, ...remainingRows] = rows;
    const match = await findSmartMatch(row);

    if (match) {
      setPendingMatch({
        match,
        remainingRows,
        row
      });
      return;
    }

    await createTransactionFromImportedRow(row);
    await processImportRowQueue(remainingRows);
  }

  async function handleImportSelected() {
    const invalidRows = selectedRows.filter((row) => !isRowImportable(row));
    const validRows = selectedRows.filter(isRowImportable);

    setError('');
    setSaving(true);

    try {
      if (invalidRows.length > 0) {
        await bulkUpdateImportedTransactions(invalidRows.map((row) => row.id), { import_status: 'needs_review' });
        setPreviewRows((currentRows) => currentRows.map((row) => (
          invalidRows.some((invalidRow) => invalidRow.id === row.id)
            ? { ...row, import_status: 'needs_review' }
            : row
        )));
        setError(`${invalidRows.length} selected row(s) need amount, date, type, and valid account/category or transfer accounts before import.`);
      }

      if (validRows.length > 0) {
        await processImportRowQueue(validRows);
      }
    } catch (err) {
      setError(err.message || 'Unable to import selected transactions.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmMatch() {
    if (!pendingMatch) {
      return;
    }

    setSaving(true);

    try {
      setSuccess('');
      const { match, remainingRows, row } = pendingMatch;

      if (match.type === 'existing_transaction') {
        await updateImportedTransactionStatus(row.id, 'duplicate', match.target.id);
        setRowStatus(row.id, 'duplicate');
        setSuccess('Statement entry linked to the existing transaction.');
      } else {
        const transaction = await createTransactionFromImportedRow(row);
        await linkDuePayment(match.target.id, transaction.id);
      }

      setPendingMatch(null);
      await processImportRowQueue(remainingRows);
    } catch (err) {
      setError(err.message || 'Unable to confirm match.');
    } finally {
      setSaving(false);
    }
  }

  async function handleIgnoreMatch() {
    if (!pendingMatch) {
      return;
    }

    setSaving(true);

    try {
      const { remainingRows, row } = pendingMatch;
      await createTransactionFromImportedRow(row);
      setPendingMatch(null);
      await processImportRowQueue(remainingRows);
    } catch (err) {
      setError(err.message || 'Unable to ignore match.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="section-kicker">Bank import</p>
          <h1>Statement Import</h1>
        </div>
      </section>

      {error && <p className="form-message error">{error}</p>}
      {success && <p className="form-message success" role="status">{success}</p>}

      <section className="import-panel">
        <div>
          <h2>Upload Statement</h2>
          <p>Upload a statement, review normalized rows, edit anything suspicious, then import only the rows you trust.</p>
        </div>

        <div className="retention-notice">
          <strong>90-day file retention</strong>
          <span>Source files and unimported review rows are removed after 90 days. Transactions already imported and report data remain available.</span>
        </div>

        <form className="form-grid" onSubmit={handleUploadReview}>
          <label
            className={`upload-dropzone span-2${draggingFile ? ' is-dragging' : ''}`}
            onDragLeave={handleFileDragLeave}
            onDragOver={handleFileDragOver}
            onDrop={handleFileDrop}
          >
            <strong>{file ? file.name : 'Choose or drop statement file'}</strong>
            {!file && <span>Click to browse, or drag and drop PDF, CSV, XLS, or XLSX</span>}
            {!file && (
              <span className="upload-dropzone-controls">
                <span className="upload-dropzone-button">Choose File</span>
                {fileSelectionMissing && <span className="upload-file-status">no file selected</span>}
              </span>
            )}
            <input
              aria-label="Choose statement file"
              accept=".pdf,.csv,.xls,.xlsx,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />
          </label>

          <div className="modal-actions span-2">
            <button className="primary-button" disabled={saving} type="submit">
              Upload and Review
            </button>
          </div>
        </form>
      </section>

      {showReviewQueue && (
        <article className={`panel statement-review-panel${reviewCollapsed ? ' is-collapsed' : ''}`}>
          <div className="panel-header">
            <div>
              <h2>Statement Review</h2>
              <p className="muted-copy">{activeImport.file_name}</p>
            </div>
            <div className="review-queue-header-actions">
              <span className="summary-pill">{selectedRows.length} selected</span>
              <button
                aria-expanded={!reviewCollapsed}
                aria-label={reviewCollapsed ? 'Expand statement review' : 'Collapse statement review'}
                className="icon-button review-queue-toggle"
                onClick={() => setReviewCollapsed((currentValue) => !currentValue)}
                title={reviewCollapsed ? 'Expand statement review' : 'Collapse statement review'}
                type="button"
              >
                <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                  <path d="m6 15 6-6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
          </div>

          {!reviewCollapsed && (
            <>
          <section className="statement-summary-grid">
            <span><strong>{reviewTotalCount}</strong> rows</span>
            <span><strong>{formatCurrency(summary.totalIncome)}</strong> income</span>
            <span><strong>{formatCurrency(summary.totalExpense)}</strong> expense</span>
            <span><strong>{formatCurrency(summary.netAmount)}</strong> net</span>
            <span><strong>{summary.rowsNeedingReview}</strong> need review</span>
            <span><strong>{summary.linkedRows}</strong> linked</span>
          </section>

          <div className="button-row">
            <button className="secondary-button" onClick={() => selectRows(filteredActiveRows)}>Select All</button>
            <button className="secondary-button" onClick={() => setSelectedIds(new Set())}>Unselect All</button>
            <button className="secondary-button danger-button" disabled={saving || selectedRows.length === 0} onClick={ignoreSelectedRows}>
              Ignore Selected
            </button>
          </div>

          <div className="filter-panel">
            <select onChange={(event) => applyBulkField('account_id', event.target.value)} value={bulkValues.account_id}>
              <option value="">Apply account to selected</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
            <select onChange={(event) => applyBulkField('category_id', event.target.value)} value={bulkValues.category_id}>
              <option value="">Apply category to selected</option>
              {allCategoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.displayName}</option>
              ))}
            </select>
            <select onChange={(event) => applyBulkField('project_tag_id', event.target.value)} value={bulkValues.project_tag_id}>
              <option value="">Apply project tag to selected</option>
              {projectTags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </div>

          <div className="statement-review-filters">
            <div className="statement-filter-tabs" role="tablist" aria-label="Filter imported rows">
              {reviewFilters.map((filter) => (
                <button
                  aria-selected={reviewFilter === filter.id}
                  className={reviewFilter === filter.id ? 'active' : ''}
                  key={filter.id}
                  onClick={() => setReviewFilter(filter.id)}
                  role="tab"
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <label className="statement-search-field">
              <span className="sr-only">Search imported rows</span>
              <input
                onChange={(event) => setReviewSearch(event.target.value)}
                placeholder="Search rows"
                type="search"
                value={reviewSearch}
              />
              {reviewSearch && (
                <button
                  aria-label="Clear search"
                  className="statement-search-clear"
                  onClick={() => setReviewSearch('')}
                  type="button"
                >
                  x
                </button>
              )}
            </label>
          </div>

          <div className="statement-preview-list">
            {filteredRows.map((row) => {
              const isEditing = editingIds.has(row.id);
              const rawVisible = rawVisibleIds.has(row.id);
              const isActiveRow = activeStatuses.has(row.import_status);

              return (
                <article className={`statement-preview-row ${row.import_status}`} key={row.id}>
                  <input
                    checked={selectedIds.has(row.id)}
                    disabled={!isActiveRow}
                    onChange={() => toggleRow(row.id)}
                    type="checkbox"
                  />
                  <div className="statement-row-main">
                    <input
                      className="statement-inline-description"
                      onBlur={() => saveInlineRow(row.id)}
                      onChange={(event) => updateRowLocal(row.id, 'clean_description', event.target.value)}
                      onKeyDown={blurOnEnter}
                      value={row.clean_description || ''}
                    />
                    <small>
                      {row.transaction_date || 'No date'} - {row.transaction_type || 'No type'} - {row.money_direction || 'no direction'} - {row.import_status}
                      {row.financial_activity && row.financial_activity !== 'standard' ? ` - ${row.financial_activity}` : ''}
                    </small>
                    {rawVisible && <small>Raw: {row.raw_description || row.description}</small>}
                  </div>
                  <button
                    className="statement-inline-amount"
                    onClick={() => toggleEdit(row.id)}
                    type="button"
                  >
                    {formatCurrency(Math.abs(Number(row.amount || 0)))}
                  </button>
                  <div className="statement-row-actions">
                    {isActiveRow && <button className="text-button" onClick={() => toggleEdit(row.id)}>Edit</button>}
                    <button className="text-button" onClick={() => toggleRaw(row.id)}>View Raw</button>
                    {isActiveRow && <button className="text-button danger" onClick={() => ignoreRow(row)}>Ignore</button>}
                  </div>

                  {isActiveRow && isEditing && (
                    <div className="statement-row-editor">
                      <label className="field-group">
                        Description
                        <input
                          onChange={(event) => updateRowLocal(row.id, 'clean_description', event.target.value)}
                          value={row.clean_description || ''}
                        />
                      </label>
                      <label className="field-group">
                        Amount
                        <input
                          min="0"
                          onChange={(event) => updateRowLocal(row.id, 'amount', event.target.value)}
                          type="number"
                          value={row.amount || 0}
                        />
                      </label>
                      <BoundedDatePicker
                        label="Date"
                        maxDate={today}
                        minDate={earliestHistoricalDate}
                        onChange={(value) => updateRowLocal(row.id, 'transaction_date', value)}
                        required
                        value={row.transaction_date || ''}
                      />
                      <label className="field-group">
                        Type
                        <select
                          onChange={(event) => updateRowLocal(row.id, 'transaction_type', event.target.value)}
                          value={row.transaction_type || 'expense'}
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                          <option value="transfer">Transfer</option>
                        </select>
                      </label>
                      <label className="field-group">
                        Activity
                        <select
                          onChange={(event) => updateRowLocal(row.id, 'financial_activity', event.target.value)}
                          value={row.financial_activity || 'standard'}
                        >
                          <option value="standard">Standard Purchase</option>
                          <option value="payment">Card payment</option>
                          <option value="refund">Refund</option>
                          <option value="fee">Fee / interest</option>
                          <option value="cash_advance">Cash advance</option>
                          <option value="installment">Installment</option>
                        </select>
                      </label>
                      {row.transaction_type === 'transfer' ? (
                        <>
                          <label className="field-group">
                            From Account
                            <select
                              onChange={(event) => updateRowLocal(row.id, 'from_account_id', event.target.value)}
                              value={row.from_account_id || ''}
                            >
                              <option value="">Select from account</option>
                              {accounts.map((account) => (
                                <option key={account.id} value={account.id}>{account.name}</option>
                              ))}
                            </select>
                          </label>
                          <label className="field-group">
                            To Account
                            <select
                              onChange={(event) => updateRowLocal(row.id, 'to_account_id', event.target.value)}
                              value={row.to_account_id || ''}
                            >
                              <option value="">Select to account</option>
                              {accounts.map((account) => (
                                <option key={account.id} value={account.id}>{account.name}</option>
                              ))}
                            </select>
                          </label>
                          <label className="field-group">
                            Transfer Fee
                            <input
                              min="0"
                              onChange={(event) => updateRowLocal(row.id, 'transfer_fee', event.target.value)}
                              type="number"
                              value={row.transfer_fee || 0}
                            />
                          </label>
                        </>
                      ) : (
                        <>
                          <label className="field-group">
                            Source Account
                            <select
                              onChange={(event) => updateRowLocal(row.id, 'account_id', event.target.value)}
                              value={row.account_id || ''}
                            >
                              <option value="">Select account</option>
                              {accounts.map((account) => (
                                <option key={account.id} value={account.id}>{account.name}</option>
                              ))}
                            </select>
                          </label>
                          <label className="field-group">
                            Category
                            <select
                              onChange={(event) => updateRowLocal(row.id, 'category_id', event.target.value)}
                              value={row.category_id || ''}
                            >
                              <option value="">Select category</option>
                              {getRowCategoryOptions(row).map((category) => (
                                <option key={category.id} value={category.id}>{category.displayName}</option>
                              ))}
                            </select>
                          </label>
                        </>
                      )}
                      <label className="field-group">
                        Project Tag
                        <select
                          onChange={(event) => updateRowLocal(row.id, 'project_tag_id', event.target.value)}
                          value={row.project_tag_id || ''}
                        >
                          <option value="">Select project tag</option>
                          {projectTags.map((tag) => (
                            <option key={tag.id} value={tag.id}>{tag.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field-group">
                        Notes
                        <input
                          onChange={(event) => updateRowLocal(row.id, 'notes', event.target.value)}
                          value={row.notes || ''}
                        />
                      </label>
                      <button className="secondary-button" onClick={() => saveRow(row)}>Save Row</button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {previewRows.length < reviewTotalCount && (
            <button
              className="statement-load-more"
              disabled={loadingMoreRows}
              onClick={loadMoreReviewRows}
              type="button"
            >
              {loadingMoreRows
                ? 'Loading...'
                : `Load more (${reviewTotalCount - previewRows.length} remaining)`}
            </button>
          )}

          {previewRows.length === 0 ? (
            <div className="empty-state">
              <p className="muted-copy">No rows were parsed from this upload.</p>
              {activeImport.file_url && !activeImport.file_deleted_at && (
                <button className="secondary-button" disabled={saving} onClick={() => reparseImport(activeImport)} type="button">
                  {saving ? 'Re-parsing...' : 'Re-parse File'}
                </button>
              )}
            </div>
          ) : filteredRows.length === 0 ? (
            <p className="muted-copy">No rows match this filter.</p>
          ) : reviewFilter !== 'linked' && activeRows.length === 0 && (
            <p className="muted-copy">No active rows left in this statement review.</p>
          )}

          {processedRows.length > 0 && (
            <details className="statement-history-detail">
              <summary>{processedRows.length} processed row{processedRows.length > 1 ? 's' : ''}</summary>
              <div className="statement-import-list">
                {processedRows.map((row) => (
                  <div className="statement-import-row" key={row.id}>
                    <div>
                      <strong>{row.clean_description || row.description}</strong>
                      <span>{row.transaction_date} - {row.import_status === 'duplicate' ? 'linked' : row.import_status}</span>
                    </div>
                    <strong>{formatCurrency(Math.abs(Number(row.amount || 0)))}</strong>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="modal-actions">
            <button className="primary-button" disabled={saving || selectedRows.length === 0} onClick={handleImportSelected}>
              {saving ? 'Importing...' : 'Import Selected'}
            </button>
          </div>
            </>
          )}
        </article>
      )}

      <article className="panel">
        <div className="panel-header">
          <h2>Import History</h2>
          <span className="summary-pill">{imports.length}</span>
        </div>
        <label className="field-group compact-field">
          Sort uploads
          <select onChange={(event) => setImportSort(event.target.value)} value={importSort}>
            <option value="latest">Latest upload</option>
            <option value="oldest">Oldest upload</option>
          </select>
        </label>

        {loading ? (
          <p className="muted-copy">Loading imports...</p>
        ) : imports.length === 0 ? (
          <p className="muted-copy">No statement files uploaded yet.</p>
        ) : (
          <div className="statement-import-list">
            {sortedImports.map((item) => {
              const retentionText = getFileRetentionText(item);

              return (
                <div className="statement-import-row" key={item.id}>
                  <div>
                    <strong>{item.file_name}</strong>
                    <span>{item.bank_name || 'Source'} - {item.file_type.toUpperCase()} - {item.import_status}</span>
                    {retentionText && <span className="file-retention-status">{retentionText}</span>}
                  </div>
                  <div className="receipt-actions">
                    <button className="text-button" onClick={() => openImportPreview(item)}>Preview</button>
                    {item.file_url && !item.file_deleted_at && (
                      <a className="text-button" href={item.file_url} rel="noreferrer" target="_blank">Open</a>
                    )}
                    {!item.file_deleted_at && (
                      <button className="text-button danger" disabled={saving} onClick={() => handleDeleteImportFile(item)}>Delete File</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>

      {file && isSourceModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="statement-source-title">
            <div className="modal-header">
              <div>
                <p className="section-kicker">Statement source</p>
                <h2 id="statement-source-title">Select source account</h2>
              </div>
              <button
                aria-label="Close source account dialog"
                className="icon-button"
                disabled={saving}
                onClick={closeSourceAccountModal}
                type="button"
              >
                x
              </button>
            </div>

            <p className="muted-copy statement-source-file-name">{file.name}</p>

            {error && <p className="form-message error">{error}</p>}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleConfirmSourceAccount();
              }}
            >
              <label className="field-group">
                Source account
                <select
                  autoFocus
                  disabled={saving}
                  onChange={(event) => setPendingSourceAccountId(event.target.value)}
                  required
                  value={pendingSourceAccountId}
                >
                  <option value="">Select the account for this statement</option>
                  {sourceAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name} ({account.type})</option>
                  ))}
                </select>
                <small>Imported rows will be parsed and assigned using this account.</small>
              </label>

              {sourceAccounts.length === 0 && (
                <p className="form-message error">Add a bank, e-wallet, credit card, or PayLater account before importing a statement.</p>
              )}

              <div className="modal-actions statement-source-actions">
                <button className="secondary-button" disabled={saving} onClick={closeSourceAccountModal} type="button">Cancel</button>
                <button
                  className="primary-button"
                  disabled={saving || !pendingSourceAccountId}
                  type="submit"
                >
                  {saving ? 'Parsing...' : 'Continue and parse'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {pendingMatch && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="match-title">
            <div className="modal-header">
              <div>
                <p className="section-kicker">Possible Match</p>
                <h2 id="match-title">{pendingMatch.match.title}</h2>
              </div>
              <button className="icon-button" aria-label="Close match dialog" onClick={() => setPendingMatch(null)}>x</button>
            </div>

            <div className="review-detail-list">
              <span>
                <strong>Imported</strong>
                {pendingMatch.row.clean_description || pendingMatch.row.description}
              </span>
              <span>
                <strong>Amount</strong>
                {formatCurrency(Math.abs(Number(pendingMatch.row.amount || 0)))}
              </span>
              <span>
                <strong>Match</strong>
                {pendingMatch.match.message}
              </span>
            </div>

            <div className="modal-actions">
              {pendingMatch.match.type === 'existing_transaction' ? (
                <>
                  <button className="primary-button" disabled={saving} onClick={handleConfirmMatch}>Link as same transaction</button>
                  <button className="secondary-button" disabled={saving} onClick={handleIgnoreMatch}>Keep both</button>
                  <button className="secondary-button" disabled={saving} onClick={() => setPendingMatch(null)}>Not a duplicate</button>
                </>
              ) : (
                <>
                  <button className="primary-button" disabled={saving} onClick={handleConfirmMatch}>Confirm</button>
                  <button className="secondary-button" disabled={saving} onClick={handleIgnoreMatch}>Ignore</button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
