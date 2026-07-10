import { useEffect, useMemo, useState } from 'react';
import useRefreshOnResume from '../hooks/useRefreshOnResume.js';
import { getAccounts } from '../services/accountService.js';
import { getCategories } from '../services/categoryService.js';
import { getProjectTags } from '../services/projectTagService.js';
import { getCurrentUserProfile } from '../services/userProfileService.js';
import { parseStatementFile } from '../services/statementParserService.js';
import {
  createStatementImport,
  deleteStatementImportFile,
  findDuplicateStatementImport,
  getStatementImports,
  saveImportedTransactions
} from '../services/statementImportService.js';
import { classifyCreditStatementRow } from '../utils/creditFacility.js';

const allowedExtensions = ['pdf', 'csv', 'xls', 'xlsx'];
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
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projectTags, setProjectTags] = useState([]);
  const [file, setFile] = useState(null);
  const [draggingFile, setDraggingFile] = useState(false);
  const [fileSelectionMissing, setFileSelectionMissing] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [defaultAccountId, setDefaultAccountId] = useState('');
  const [importSort, setImportSort] = useState('latest');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const sourceAccounts = useMemo(() => (
    accounts.filter((account) => ['Bank', 'E-Wallet', 'Credit Card', 'PayLater'].includes(account.type))
  ), [accounts]);
  const sourceOptions = useMemo(() => (
    [...new Set([...sourceAccounts.map((account) => account.name), 'Generic PDF'])]
  ), [sourceAccounts]);
  const defaultAccount = useMemo(() => (
    accounts.find((account) => account.id === defaultAccountId) || null
  ), [accounts, defaultAccountId]);

  const sortedImports = useMemo(() => (
    [...imports].sort((first, second) => {
      const firstTime = new Date(first.created_at || 0).getTime();
      const secondTime = new Date(second.created_at || 0).getTime();
      return importSort === 'oldest' ? firstTime - secondTime : secondTime - firstTime;
    })
  ), [importSort, imports]);

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

  function getRowsWithSourceAccount(rows, importSourceName = sourceName) {
    const sourceAccount = sourceAccounts.find((account) => account.name === importSourceName);
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

  async function handleSubmit(event) {
    event.preventDefault();

    if (!file) {
      setError('');
      setFileSelectionMissing(true);
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

      const rows = await parseStatementFile(file, sourceName);

      if (rows.length === 0) {
        throw new Error('No transaction rows were found in this statement. Check that the file contains dated debit/credit rows.');
      }

      const statementImport = await createStatementImport(file, sourceName, {
        fileHash: duplicate.fileHash
      });
      const rowsWithSourceAccount = getRowsWithSourceAccount(rows);
      await saveImportedTransactions(statementImport.id, rowsWithSourceAccount);

      setFile(null);
      event.target.reset();
      setSuccess('Statement uploaded and saved to Import History.');
      await loadImports();
    } catch (err) {
      setError(err.message || 'Unable to upload and parse statement.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteImportFile(item) {
    const confirmed = window.confirm(
      `Delete "${item.file_name}" now?\n\nThe source file and parsed statement rows will be removed. Transactions already imported and report data will remain.`
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
    } catch (err) {
      setError(err.message || 'Unable to delete uploaded file.');
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
          <p>Upload a statement to save the source file and parsed statement data in Import History.</p>
        </div>

        <div className="retention-notice">
          <strong>90-day file retention</strong>
          <span>Source files and parsed statement rows are removed after 90 days. Transactions already imported and report data remain available.</span>
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
              type="file"
            />
          </label>

          <div className="modal-actions span-2">
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Parsing...' : 'Upload Statement'}
            </button>
          </div>
        </form>
      </section>

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
    </div>
  );
}
