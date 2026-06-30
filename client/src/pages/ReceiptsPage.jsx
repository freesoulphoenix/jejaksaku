import { useEffect, useRef, useState } from 'react';
import useRefreshOnResume from '../hooks/useRefreshOnResume.js';
import ReceiptDetailPage from './ReceiptDetailPage.jsx';
import { getAccounts } from '../services/accountService.js';
import { getCategories } from '../services/categoryService.js';
import { runReceiptOcr } from '../services/ocrService.js';
import { getProjectTags } from '../services/projectTagService.js';
import { getCurrentUserProfile } from '../services/userProfileService.js';
import { createReceipt, createTransactionFromReceipt, deleteReceipt, getReceipt, getReceipts, linkReceiptToTransaction, updateReceiptReview } from '../services/receiptService.js';
import { formatCurrency } from '../utils/format.js';

const emptyForm = {
  file: null,
  merchant_name: '',
  receipt_date: '',
  total_amount: 0,
  processing_status: 'pending'
};

const acceptedReceiptTypes = 'image/*,.pdf,application/pdf';

function isHeicReceiptFile(file) {
  const fileName = file?.name?.toLowerCase() || '';
  const fileType = file?.type?.toLowerCase() || '';

  return fileName.endsWith('.heic')
    || fileName.endsWith('.heif')
    || fileType === 'image/heic'
    || fileType === 'image/heif';
}

function isPdfReceiptUrl(url) {
  return /\.pdf($|\?)/i.test(url || '');
}

function isStoredFileAvailable(item) {
  return Boolean(item.image_url && !item.file_deleted_at);
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

function getReceiptRetentionText(receipt) {
  if (receipt.file_deleted_at) {
    return 'File expired - entry retained';
  }

  if (receipt.file_retention_expires_at) {
    return `File kept until ${formatRetentionDate(receipt.file_retention_expires_at)}`;
  }

  return '';
}

export default function ReceiptsPage({ pendingReceiptFile, onReceiptFileConsumed }) {
  const receiptInputRef = useRef(null);
  const [receipts, setReceipts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projectTags, setProjectTags] = useState([]);
  const [defaultAccountId, setDefaultAccountId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [previewUrl, setPreviewUrl] = useState('');
  const [conversionNote, setConversionNote] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [sheetMode, setSheetMode] = useState(null);
  const [fileKind, setFileKind] = useState('image');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [convertingFile, setConvertingFile] = useState(false);
  const [error, setError] = useState('');

  async function loadReceipts(background = false) {
    setError('');
    if (!background) setLoading(true);

    try {
      const [receiptData, accountData, categoryData, projectTagData, profileData] = await Promise.all([
        getReceipts(),
        getAccounts(),
        getCategories(),
        getProjectTags(),
        getCurrentUserProfile()
      ]);
      setReceipts(receiptData);
      setAccounts(accountData);
      setCategories(categoryData);
      setProjectTags(projectTagData);
      setDefaultAccountId(profileData?.default_account_id || '');
    } catch (err) {
      setError(err.message || 'Unable to load receipts.');
    } finally {
      if (!background) setLoading(false);
    }
  }

  useEffect(() => {
    loadReceipts();
  }, []);

  useRefreshOnResume(() => loadReceipts(true));

  useEffect(() => () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  useEffect(() => {
    if (!pendingReceiptFile?.file) {
      return;
    }

    handleIncomingReceiptFile(pendingReceiptFile.file);
    onReceiptFileConsumed?.();
  }, [pendingReceiptFile?.token]);

  function updateField(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function getJpegFileName(fileName) {
    return fileName.replace(/\.(heic|heif)$/i, '.jpg') || 'receipt.jpg';
  }

  async function convertHeicToJpeg(file) {
    const heic2anyModule = await import('heic2any');
    const heic2any = heic2anyModule.default;
    const convertedBlob = await heic2any({
      blob: file,
      quality: 0.92,
      toType: 'image/jpeg'
    });
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

    return new File([blob], getJpegFileName(file.name), {
      lastModified: Date.now(),
      type: 'image/jpeg'
    });
  }

  function resetUploadState() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setForm(emptyForm);
    setPreviewUrl('');
    setConversionNote('');
    setFileKind('image');
  }

  async function prepareFileForUpload(file, kind = 'image') {
    setError('');
    setConversionNote('');

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (!file) {
      updateField('file', null);
      setPreviewUrl('');
      return;
    }

    setFileKind(kind);

    if (kind === 'pdf') {
      updateField('file', file);
      setPreviewUrl('');
      setSheetMode('form');
      return;
    }

    if (!isHeicReceiptFile(file)) {
      updateField('file', file);
      setPreviewUrl(URL.createObjectURL(file));
      setSheetMode('form');
      return;
    }

    setConvertingFile(true);

    try {
      const convertedFile = await convertHeicToJpeg(file);
      updateField('file', convertedFile);
      setPreviewUrl(URL.createObjectURL(convertedFile));
      setConversionNote(`${file.name} converted to JPEG for preview.`);
      setSheetMode('form');
    } catch (err) {
      updateField('file', null);
      setPreviewUrl('');
      setError('Could not convert this HEIC file for preview. Please choose another HEIC image or convert it to JPG first.');
    } finally {
      setConvertingFile(false);
    }
  }

  async function handleIncomingReceiptFile(file) {
    const fileName = file?.name?.toLowerCase() || '';
    const fileType = file?.type?.toLowerCase() || '';
    const kind = fileName.endsWith('.pdf') || fileType === 'application/pdf'
      ? 'pdf'
      : 'image';

    await prepareFileForUpload(file, kind);
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    await handleIncomingReceiptFile(file);
  }

  function openNativeReceiptPicker() {
    resetUploadState();
    receiptInputRef.current?.click();
  }

  function closeReceiptSheet() {
    resetUploadState();
    setSheetMode(null);
  }

  async function handlePreviewOcr() {
    setError('');
    setSaving(true);

    try {
      const receipt = await createReceipt(form);
      let processedReceipt;

      try {
        processedReceipt = await runReceiptOcr(receipt);
      } catch (ocrError) {
        const detailedReceipt = await getReceipt(receipt.id);
        closeReceiptSheet();
        setSelectedReceipt({
          ...detailedReceipt,
          ocr_error: ocrError.message || 'OCR could not read this receipt. Enter the details manually.'
        });
        await loadReceipts();
        return;
      }

      closeReceiptSheet();
      const detailedReceipt = await getReceipt(receipt.id);
      setSelectedReceipt({
        ...detailedReceipt,
        ocr_text: processedReceipt.ocr_text || ''
      });
      await loadReceipts();
    } catch (err) {
      setError(err.message || 'Unable to save receipt.');
    } finally {
      setSaving(false);
    }
  }

  async function openReceiptDetail(receipt) {
    setError('');

    try {
      const data = await getReceipt(receipt.id);
      setSelectedReceipt(data);
    } catch (err) {
      setError(err.message || 'Unable to open receipt.');
    }
  }

  async function handleDelete(receipt) {
    const confirmed = window.confirm(`Delete receipt from ${receipt.merchant_name || 'this merchant'}?`);

    if (!confirmed) {
      return;
    }

    setError('');

    try {
      await deleteReceipt(receipt.id);
      await loadReceipts();
    } catch (err) {
      setError(err.message || 'Unable to delete receipt.');
    }
  }

  async function handleSaveReview(id, review) {
    const updatedReceipt = await updateReceiptReview(id, {
      ...review,
      processing_status: 'completed'
    });
    const detailedReceipt = await getReceipt(updatedReceipt.id);
    setSelectedReceipt(detailedReceipt);
    await loadReceipts();
  }

  async function handleCreateTransaction(receiptId, transaction) {
    await createTransactionFromReceipt(receiptId, transaction);
    const detailedReceipt = await getReceipt(receiptId);
    setSelectedReceipt(detailedReceipt);
    await loadReceipts();
  }

  async function handleLinkReceiptTransaction(receiptId, transactionId) {
    await linkReceiptToTransaction(receiptId, transactionId);
    const detailedReceipt = await getReceipt(receiptId);
    setSelectedReceipt(detailedReceipt);
    await loadReceipts();
  }

  if (selectedReceipt) {
    return (
      <ReceiptDetailPage
        accounts={accounts}
        categories={categories}
        defaultAccountId={defaultAccountId}
        onBack={() => setSelectedReceipt(null)}
        onCreateTransaction={handleCreateTransaction}
        onSaveReview={handleSaveReview}
        onLinkTransaction={handleLinkReceiptTransaction}
        projectTags={projectTags}
        receipt={selectedReceipt}
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="section-kicker">Receipt review</p>
          <h1>Receipts</h1>
        </div>
        <button className="primary-button desktop-receipt-upload-button" onClick={openNativeReceiptPicker}>Upload Receipt</button>
      </section>

      {error && <p className="form-message error">{error}</p>}

      <input
        accept={acceptedReceiptTypes}
        className="visually-hidden-file"
        onChange={handleFileChange}
        ref={receiptInputRef}
        type="file"
      />

      {sheetMode && (
        <div className="bottom-sheet-backdrop" role="presentation">
          <section aria-modal="true" className="bottom-sheet" role="dialog">
            <div className="bottom-sheet-grabber" />

            {sheetMode === 'form' && (
              <>
                <div className="bottom-sheet-header">
                  <div>
                    <p className="section-kicker">{fileKind === 'pdf' ? 'PDF receipt' : 'Receipt image'}</p>
                    <h2>Scan Receipt</h2>
                  </div>
                  <button
                    aria-label="Close receipt scanner"
                    className="bottom-sheet-close-button"
                    onClick={closeReceiptSheet}
                    title="Close"
                    type="button"
                  >
                    <i className="fi fi-rr-cross-small" aria-hidden="true" />
                  </button>
                </div>

                <div className="receipt-scan-actions">
                  <button className="primary-button" disabled={saving || convertingFile} onClick={handlePreviewOcr} type="button">
                    {saving ? 'Reading receipt...' : convertingFile ? 'Converting...' : 'Run OCR'}
                  </button>
                </div>

                <div className="retention-notice">
                  <strong>90-day file retention</strong>
                  <span>Receipt files are kept for 90 days to save storage. The transaction entry and report data will remain unless you delete them.</span>
                </div>

                <div className="form-grid">
                  {previewUrl && (
                    <div className="receipt-upload-preview span-2">
                      <img alt="Receipt upload preview" src={previewUrl} />
                    </div>
                  )}

                  {!previewUrl && fileKind === 'pdf' && form.file && (
                    <div className="receipt-upload-preview span-2">
                      <div className="receipt-preview-fallback">
                        <strong>PDF receipt selected</strong>
                        <span>{form.file.name}</span>
                      </div>
                    </div>
                  )}

                  {(conversionNote || convertingFile) && (
                    <p className="receipt-conversion-note span-2">
                      {convertingFile ? 'Converting HEIC preview...' : conversionNote}
                    </p>
                  )}

                </div>
              </>
            )}
          </section>
        </div>
      )}

      {loading && <p className="muted-copy">Loading receipts...</p>}

      {!loading && receipts.length === 0 && (
        <section className="empty-state">
          <div className="empty-icon">RC</div>
          <h2>No receipts yet</h2>
          <p>Captured photos and uploaded receipt files will appear here.</p>
        </section>
      )}

      <section className="receipt-grid">
        {receipts.map((receipt) => {
          const fileAvailable = isStoredFileAvailable(receipt);
          const retentionText = getReceiptRetentionText(receipt);

          return (
            <article className="receipt-card" key={receipt.id}>
              <button className="receipt-image-button" onClick={() => openReceiptDetail(receipt)}>
                {fileAvailable && isPdfReceiptUrl(receipt.image_url) ? (
                  <span>PDF receipt</span>
                ) : fileAvailable ? (
                  <img alt={receipt.merchant_name || 'Receipt'} src={receipt.image_url} />
                ) : receipt.file_deleted_at ? (
                  <span>File expired</span>
                ) : (
                  <span>No image</span>
                )}
              </button>
              <div className="receipt-card-body">
                <strong>{receipt.merchant_name || 'Untitled Receipt'}</strong>
                <span>{receipt.receipt_date || 'No date'} - {receipt.processing_status || 'pending'}</span>
                <span>{formatCurrency(receipt.total_amount || 0)}</span>
                {retentionText && <span className="file-retention-status">{retentionText}</span>}
              </div>
              <div className="receipt-actions">
                <button className="text-button" onClick={() => openReceiptDetail(receipt)}>View</button>
                <button className="text-button danger" onClick={() => handleDelete(receipt)}>Delete</button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
