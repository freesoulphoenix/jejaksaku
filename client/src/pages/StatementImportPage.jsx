import { useEffect, useMemo, useState } from 'react';
import { getAccounts } from '../services/accountService.js';
import { getCategories } from '../services/categoryService.js';
import { findSmartMatch } from '../services/matchingService.js';
import { getProjectTags } from '../services/projectTagService.js';
import { parseStatementFile } from '../services/statementParserService.js';
import {
  bulkUpdateImportedTransactions,
  createStatementImport,
  deleteStatementImportFile,
  findDuplicateStatementImport,
  getImportedTransactions,
  getStatementImports,
  saveImportedTransactions,
  updateImportedTransaction,
  updateImportedTransactionStatus
} from '../services/statementImportService.js';
import { createTransaction } from '../services/transactionService.js';
import { linkDuePayment } from '../services/upcomingDueService.js';
import { getCategoryOptions } from '../utils/categoryOptions.js';
import { formatCurrency } from '../utils/format.js';
import { resolveMoneyDirection } from '../utils/transactionDirection.js';

const allowedExtensions = ['pdf', 'csv', 'xlsx'];
const activeStatuses = new Set(['pending', 'needs_review']);
const processedStatuses = new Set(['imported', 'ignored', 'duplicate']);

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

export default function StatementImportPage() {
  const [imports, setImports] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeImport, setActiveImport] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projectTags, setProjectTags] = useState([]);
  const [file, setFile] = useState(null);
  const [sourceName, setSourceName] = useState('BCA');
  const [importSort, setImportSort] = useState('latest');
  const [editingIds, setEditingIds] = useState(new Set());
  const [rawVisibleIds, setRawVisibleIds] = useState(new Set());
  const [pendingMatch, setPendingMatch] = useState(null);
  const [reviewCollapsed, setReviewCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const categoryOptions = useMemo(() => getCategoryOptions(categories), [categories]);
  const sourceAccounts = useMemo(() => (
    accounts.filter((account) => ['Bank', 'E-Wallet'].includes(account.type))
  ), [accounts]);
  const sourceOptions = useMemo(() => (
    [...new Set([...sourceAccounts.map((account) => account.name), 'Generic PDF'])]
  ), [sourceAccounts]);

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

  const selectedRows = useMemo(() => (
    activeRows.filter((row) => selectedIds.has(row.id))
  ), [activeRows, selectedIds]);

  const processedRows = useMemo(() => (
    previewRows.filter((row) => processedStatuses.has(row.import_status))
  ), [previewRows]);

  const summary = useMemo(() => {
    const totalIncome = selectedRows
      .filter((row) => row.transaction_type === 'income')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const totalExpense = selectedRows
      .filter((row) => row.transaction_type === 'expense')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const rowsNeedingReview = activeRows.filter((row) => row.import_status === 'needs_review').length;
    const linkedRows = processedRows.filter((row) => row.import_status === 'duplicate').length;

    return {
      linkedRows,
      netAmount: totalIncome - totalExpense,
      rowsNeedingReview,
      totalExpense,
      totalIncome
    };
  }, [activeRows, processedRows, selectedRows]);

  async function loadImports() {
    setError('');
    setLoading(true);

    try {
      const [importData, accountData, categoryData, projectTagData] = await Promise.all([
        getStatementImports(),
        getAccounts(),
        getCategories(),
        getProjectTags()
      ]);
      setImports(importData);
      setAccounts(accountData);
      setCategories(categoryData);
      setProjectTags(projectTagData);
    } catch (err) {
      setError(err.message || 'Unable to load imports.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadImports();
  }, []);

  useEffect(() => {
    if (!success) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setSuccess(''), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [success]);

  useEffect(() => {
    if (loading || sourceOptions.includes(sourceName)) {
      return;
    }

    setSourceName(sourceOptions[0] || 'Generic PDF');
  }, [loading, sourceName, sourceOptions]);

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0] || null;

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const fileType = getFileType(selectedFile);

    if (!allowedExtensions.includes(fileType)) {
      setError('Only PDF, CSV, and XLSX statement files are supported.');
      setFile(null);
      event.target.value = '';
      return;
    }

    setError('');
    setFile(selectedFile);
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

  async function openImportPreview(statementImport) {
    setError('');

    try {
      const rows = await getImportedTransactions(statementImport.id);
      setActiveImport(statementImport);
      setReviewCollapsed(false);
      setPreviewRows(rows);
      selectRows(rows.filter((row) => row.import_status === 'pending'));
    } catch (err) {
      setError(err.message || 'Unable to open import preview.');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!file) {
      setError('Choose a statement file first.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const duplicate = await findDuplicateStatementImport(file, sourceName);

      if (duplicate.existing) {
        const uploadedAt = duplicate.existing.created_at
          ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(duplicate.existing.created_at))
          : 'an earlier upload';
        const shouldContinue = window.confirm(
          `Possible duplicate file found\n\nExisting file: ${duplicate.existing.file_name}\nUploaded: ${uploadedAt}\n\nCancel upload or choose OK to upload anyway.`
        );

        if (!shouldContinue) {
          setSaving(false);
          return;
        }
      }

      const statementImport = await createStatementImport(file, sourceName, {
        fileHash: duplicate.fileHash
      });
      const rows = await parseStatementFile(file, sourceName);
      const sourceAccount = sourceAccounts.find((account) => account.name === sourceName);
      const rowsWithSourceAccount = rows.map((row) => ({
        ...row,
        account_id: row.account_id || sourceAccount?.id || null
      }));
      const savedRows = await saveImportedTransactions(statementImport.id, rowsWithSourceAccount);
      setFile(null);
      event.target.reset();
      setActiveImport(statementImport);
      setReviewCollapsed(false);
      setPreviewRows(savedRows);
      selectRows(savedRows.filter((row) => row.import_status === 'pending'));
      await loadImports();
    } catch (err) {
      setError(err.message || 'Unable to upload and parse statement.');
    } finally {
      setSaving(false);
    }
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
    const transaction = await createTransaction({
      account_id: row.account_id,
      from_account_id: row.transaction_type === 'transfer'
        ? row.from_account_id || (row.money_direction === 'out' ? row.account_id : null)
        : null,
      to_account_id: row.transaction_type === 'transfer'
        ? row.to_account_id || (row.money_direction === 'in' ? row.account_id : null)
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

    const refreshedRows = await getImportedTransactions(activeImport.id);
    setPreviewRows(refreshedRows);
    setSelectedIds(new Set());
    await loadImports();
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

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field-group">
            Source account
            <select onChange={(event) => setSourceName(event.target.value)} value={sourceName}>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </label>

          <label className="upload-dropzone span-2">
            <strong>{file ? file.name : 'Choose statement file'}</strong>
            <span>PDF, CSV, or XLSX</span>
            <input
              accept=".pdf,.csv,.xlsx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
              type="file"
            />
          </label>

          <div className="modal-actions span-2">
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Parsing...' : 'Upload and Review'}
            </button>
          </div>
        </form>
      </section>

      {activeImport && (
        <article className={`panel statement-review-panel${reviewCollapsed ? ' is-collapsed' : ''}`}>
          <div className="panel-header">
            <div>
              <h2>Review Queue</h2>
              <p className="muted-copy">{activeImport.file_name}</p>
            </div>
            <div className="review-queue-header-actions">
              <span className="summary-pill">{selectedRows.length} selected</span>
              <button
                aria-expanded={!reviewCollapsed}
                aria-label={reviewCollapsed ? 'Expand review queue' : 'Collapse review queue'}
                className="icon-button review-queue-toggle"
                onClick={() => setReviewCollapsed((currentValue) => !currentValue)}
                title={reviewCollapsed ? 'Expand review queue' : 'Collapse review queue'}
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
            <span><strong>{selectedRows.length}</strong> selected</span>
            <span><strong>{formatCurrency(summary.totalIncome)}</strong> income</span>
            <span><strong>{formatCurrency(summary.totalExpense)}</strong> expense</span>
            <span><strong>{formatCurrency(summary.netAmount)}</strong> net</span>
            <span><strong>{summary.rowsNeedingReview}</strong> need review</span>
            <span><strong>{summary.linkedRows}</strong> linked</span>
          </section>

          <div className="button-row">
            <button className="secondary-button" onClick={() => selectRows(activeRows)}>Select All</button>
            <button className="secondary-button" onClick={() => setSelectedIds(new Set())}>Unselect All</button>
            <button className="secondary-button danger-button" disabled={saving || selectedRows.length === 0} onClick={ignoreSelectedRows}>
              Ignore Selected
            </button>
          </div>

          <div className="filter-panel">
            <select onChange={(event) => applyBulkField('account_id', event.target.value)} value="">
              <option value="">Apply account to selected</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
            <select onChange={(event) => applyBulkField('category_id', event.target.value)} value="">
              <option value="">Apply category to selected</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.displayName}</option>
              ))}
            </select>
            <select onChange={(event) => applyBulkField('project_tag_id', event.target.value)} value="">
              <option value="">Apply project tag to selected</option>
              {projectTags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </div>

          <div className="statement-preview-list">
            {activeRows.map((row) => {
              const isEditing = editingIds.has(row.id);
              const rawVisible = rawVisibleIds.has(row.id);

              return (
                <article className={`statement-preview-row ${row.import_status}`} key={row.id}>
                  <input
                    checked={selectedIds.has(row.id)}
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
                    <button className="text-button" onClick={() => toggleEdit(row.id)}>Edit</button>
                    <button className="text-button" onClick={() => toggleRaw(row.id)}>View Raw</button>
                    <button className="text-button danger" onClick={() => ignoreRow(row)}>Ignore</button>
                  </div>

                  {isEditing && (
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
                      <label className="field-group">
                        Date
                        <input
                          onChange={(event) => updateRowLocal(row.id, 'transaction_date', event.target.value)}
                          type="date"
                          value={row.transaction_date || ''}
                        />
                      </label>
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
                        <label className="field-group">
                          Category
                          <select
                            onChange={(event) => updateRowLocal(row.id, 'category_id', event.target.value)}
                            value={row.category_id || ''}
                          >
                            <option value="">Select category</option>
                            {categoryOptions.map((category) => (
                              <option key={category.id} value={category.id}>{category.displayName}</option>
                            ))}
                          </select>
                        </label>
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

          {activeRows.length === 0 && <p className="muted-copy">No active rows left in this review queue.</p>}

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

      {pendingMatch && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="match-title">
            <div className="modal-header">
              <div>
                <p className="section-kicker">Possible Match Found</p>
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

            <p className="muted-copy">
              This is only a warning. No entry has been changed. Review the match and choose what the app should do.
            </p>

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
