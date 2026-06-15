import { useState } from 'react';
import { formatCurrency, parseCurrencyInput } from '../utils/format.js';

export default function ReceiptDetailPage({
  accounts = [],
  categories = [],
  onBack,
  onCreateTransaction,
  onRunOcr,
  onSaveReview,
  projectTags = [],
  receipt
}) {
  const items = receipt.receipt_items || [];
  const linkedTransaction = receipt.linked_transaction;
  const [form, setForm] = useState({
    merchant_name: receipt.merchant_name || '',
    receipt_date: receipt.receipt_date || '',
    total_amount: receipt.total_amount || 0
  });
  const [transactionForm, setTransactionForm] = useState({
    account_id: '',
    category_id: '',
    project_tag_id: ''
  });
  const [saving, setSaving] = useState(false);
  const [creatingTransaction, setCreatingTransaction] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [error, setError] = useState('');

  function updateField(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function updateTransactionField(field, value) {
    setTransactionForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      await onSaveReview(receipt.id, form);
    } catch (err) {
      setError(err.message || 'Unable to save receipt review.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRunOcr() {
    setError('');
    setProcessing(true);

    try {
      await onRunOcr(receipt);
    } catch (err) {
      setError(err.message || 'Unable to run OCR.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleCreateTransaction(event) {
    event.preventDefault();
    setError('');
    setCreatingTransaction(true);

    try {
      await onCreateTransaction(receipt.id, transactionForm);
    } catch (err) {
      setError(err.message || 'Unable to create transaction from receipt.');
    } finally {
      setCreatingTransaction(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="section-kicker">Receipt detail</p>
          <h1>{receipt.merchant_name || 'Untitled Receipt'}</h1>
        </div>
        <div className="button-row">
          <button className="secondary-button" disabled={processing} onClick={handleRunOcr}>
            {processing ? 'Processing...' : 'Run OCR'}
          </button>
          <button className="secondary-button" onClick={onBack}>Back to Receipts</button>
        </div>
      </section>

      {error && <p className="form-message error">{error}</p>}

      <section className="receipt-detail-grid">
        <article className="panel">
          {receipt.image_url && !imageFailed ? (
            <img
              alt={receipt.merchant_name || 'Receipt preview'}
              className="receipt-preview-image"
              onError={() => setImageFailed(true)}
              src={receipt.image_url}
            />
          ) : (
            <div className="receipt-detail-fallback">
              <strong>Preview unavailable</strong>
              <span>This receipt image cannot be displayed by the browser. If this was a HEIC upload, delete it and upload it again so Dompet Daily can convert it to JPEG first.</span>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Review Extracted Data</h2>
            <span className="summary-pill">{receipt.processing_status || 'pending'}</span>
          </div>

          <form className="form-grid" onSubmit={handleSave}>
            <label className="field-group span-2">
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
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? 'Saving...' : 'Save Review'}
              </button>
            </div>
          </form>

          <h3>Line Items</h3>
          {items.length === 0 ? (
            <p className="muted-copy">Line item OCR is not connected yet. Merchant, date, and total are available for review.</p>
          ) : (
            <div className="receipt-item-list">
              {items.map((item) => (
                <span key={item.id}>
                  <strong>{item.item_name}</strong>
                  {formatCurrency(item.line_total || 0)}
                </span>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Create Transaction</h2>
            {linkedTransaction && <span className="summary-pill">Linked</span>}
          </div>

          {linkedTransaction ? (
            <div className="review-detail-list">
              <span>
                <strong>Account</strong>
                {linkedTransaction.accounts?.name || 'Not set'}
              </span>
              <span>
                <strong>Category</strong>
                {linkedTransaction.categories?.name || 'Not set'}
              </span>
              <span>
                <strong>Amount</strong>
                {formatCurrency(linkedTransaction.amount || 0)}
              </span>
            </div>
          ) : (
            <form className="form-grid" onSubmit={handleCreateTransaction}>
              <label className="field-group">
                Account
                <select
                  onChange={(event) => updateTransactionField('account_id', event.target.value)}
                  required
                  value={transactionForm.account_id}
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
                  onChange={(event) => updateTransactionField('category_id', event.target.value)}
                  required
                  value={transactionForm.category_id}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>

              <label className="field-group span-2">
                Project Tag
                <select
                  onChange={(event) => updateTransactionField('project_tag_id', event.target.value)}
                  value={transactionForm.project_tag_id}
                >
                  <option value="">Select project tag</option>
                  {projectTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              </label>

              <div className="modal-actions span-2">
                <button className="primary-button" disabled={creatingTransaction} type="submit">
                  {creatingTransaction ? 'Creating...' : 'Create Transaction'}
                </button>
              </div>
            </form>
          )}
        </article>
      </section>
    </div>
  );
}
