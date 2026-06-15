import { useEffect, useRef, useState } from 'react';
import ReceiptDetailPage from './ReceiptDetailPage.jsx';
import { getAccounts } from '../services/accountService.js';
import { getCategories } from '../services/categoryService.js';
import { runReceiptOcr } from '../services/ocrService.js';
import { getProjectTags } from '../services/projectTagService.js';
import { createReceipt, createTransactionFromReceipt, deleteReceipt, getReceipt, getReceipts, updateReceiptReview } from '../services/receiptService.js';
import { formatCurrency, parseCurrencyInput } from '../utils/format.js';

const today = new Date().toISOString().slice(0, 10);

const emptyForm = {
  file: null,
  merchant_name: '',
  receipt_date: today,
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

export default function ReceiptsPage({ pendingReceiptFile, onReceiptFileConsumed }) {
  const receiptInputRef = useRef(null);
  const [receipts, setReceipts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projectTags, setProjectTags] = useState([]);
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

  async function loadReceipts() {
    setError('');
    setLoading(true);

    try {
      const [receiptData, accountData, categoryData, projectTagData] = await Promise.all([
        getReceipts(),
        getAccounts(),
        getCategories(),
        getProjectTags()
      ]);
      setReceipts(receiptData);
      setAccounts(accountData);
      setCategories(categoryData);
      setProjectTags(projectTagData);
    } catch (err) {
      setError(err.message || 'Unable to load receipts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReceipts();
  }, []);

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

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const receipt = await createReceipt(form);
      closeReceiptSheet();
      const detailedReceipt = await getReceipt(receipt.id);
      setSelectedReceipt(detailedReceipt);
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

  async function handleRunOcr(receipt) {
    setError('');
    const processedReceipt = await runReceiptOcr(receipt);
    const detailedReceipt = await getReceipt(processedReceipt.id);
    setSelectedReceipt(detailedReceipt);
    await loadReceipts();
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

  if (selectedReceipt) {
    return (
      <ReceiptDetailPage
        accounts={accounts}
        categories={categories}
        onBack={() => setSelectedReceipt(null)}
        onCreateTransaction={handleCreateTransaction}
        onRunOcr={handleRunOcr}
        onSaveReview={handleSaveReview}
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
                    <h2>Save Receipt</h2>
                  </div>
                  <button className="text-button" onClick={closeReceiptSheet} type="button">Cancel</button>
                </div>

                <div className="retention-notice">
                  <strong>90-day file retention</strong>
                  <span>Receipt files are kept for 90 days to save storage. The transaction entry and report data will remain unless you delete them.</span>
                </div>

                <form className="form-grid" onSubmit={handleSubmit}>
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

                  <label className="field-group">
                    Merchant
                    <input
                      onChange={(event) => updateField('merchant_name', event.target.value)}
                      placeholder="Merchant name"
                      value={form.merchant_name}
                    />
                  </label>

                  <label className="field-group">
                    Receipt Date
                    <input
                      onChange={(event) => updateField('receipt_date', event.target.value)}
                      type="date"
                      value={form.receipt_date}
                    />
                  </label>

                  <label className="field-group">
                    Total Amount
                    <input
                      inputMode="numeric"
                      onChange={(event) => updateField('total_amount', parseCurrencyInput(event.target.value))}
                      type="text"
                      value={formatCurrency(form.total_amount || 0)}
                    />
                  </label>

                  <div className="modal-actions span-2">
                    <button className="secondary-button" onClick={closeReceiptSheet} type="button">Cancel</button>
                    <button className="primary-button" disabled={saving || convertingFile} type="submit">
                      {saving ? 'Saving...' : convertingFile ? 'Converting...' : 'Save Receipt'}
                    </button>
                  </div>
                </form>
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
        {receipts.map((receipt) => (
          <article className="receipt-card" key={receipt.id}>
            <button className="receipt-image-button" onClick={() => openReceiptDetail(receipt)}>
              {isPdfReceiptUrl(receipt.image_url) ? (
                <span>PDF receipt</span>
              ) : receipt.image_url ? (
                <img alt={receipt.merchant_name || 'Receipt'} src={receipt.image_url} />
              ) : (
                <span>No image</span>
              )}
            </button>
            <div className="receipt-card-body">
              <strong>{receipt.merchant_name || 'Untitled Receipt'}</strong>
              <span>{receipt.receipt_date || 'No date'} - {receipt.processing_status || 'pending'}</span>
              <span>{formatCurrency(receipt.total_amount || 0)}</span>
            </div>
            <div className="receipt-actions">
              <button className="text-button" onClick={() => openReceiptDetail(receipt)}>View</button>
              <button className="text-button danger" onClick={() => handleDelete(receipt)}>Delete</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
