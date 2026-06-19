import { useMemo, useState } from 'react';
import { findSmartMatch } from '../services/matchingService.js';
import { getCategoryOptions } from '../utils/categoryOptions.js';
import { formatCurrency, parseCurrencyInput } from '../utils/format.js';

export default function ReceiptDetailPage({
  accounts = [],
  categories = [],
  onBack,
  onCreateTransaction,
  onLinkTransaction,
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
  const [touchedFields, setTouchedFields] = useState(new Set());
  const [pendingDuplicate, setPendingDuplicate] = useState(null);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const categoryOptions = useMemo(() => getCategoryOptions(categories), [categories]);
  const fileExpired = Boolean(receipt.file_deleted_at);
  const canPreviewFile = Boolean(receipt.image_url && !fileExpired);

  function updateField(field, value) {
    setTouchedFields((currentFields) => new Set(currentFields).add(field));
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
      const processedReceipt = await onRunOcr(receipt);
      const nextValues = {
        merchant_name: processedReceipt?.merchant_name || '',
        receipt_date: processedReceipt?.receipt_date || '',
        total_amount: processedReceipt?.total_amount || 0
      };

      if (!nextValues.merchant_name && !nextValues.receipt_date && !nextValues.total_amount) {
        setError('No usable OCR values were found. You can still enter receipt details manually.');
        return;
      }

      setForm((currentForm) => ({
        merchant_name: touchedFields.has('merchant_name') ? currentForm.merchant_name : nextValues.merchant_name || currentForm.merchant_name,
        receipt_date: touchedFields.has('receipt_date') ? currentForm.receipt_date : nextValues.receipt_date || currentForm.receipt_date,
        total_amount: touchedFields.has('total_amount') ? currentForm.total_amount : nextValues.total_amount || currentForm.total_amount
      }));

      const suggestedCategoryId = getSuggestedCategoryId(nextValues.merchant_name, categoryOptions);

      if (suggestedCategoryId && !transactionForm.category_id) {
        setTransactionForm((currentForm) => ({
          ...currentForm,
          category_id: suggestedCategoryId
        }));
      }
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
      const match = await findSmartMatch({
        account_id: transactionForm.account_id,
        amount: form.total_amount,
        clean_description: form.merchant_name,
        description: form.merchant_name,
        transaction_date: form.receipt_date,
        transaction_type: 'expense'
      });

      if (match?.type === 'existing_transaction') {
        setPendingDuplicate(match);
        setPendingTransaction({ ...transactionForm });
        return;
      }

      await onCreateTransaction(receipt.id, transactionForm);
    } catch (err) {
      setError(err.message || 'Unable to create transaction from receipt.');
    } finally {
      setCreatingTransaction(false);
    }
  }

  async function handleKeepBoth() {
    setPendingDuplicate(null);
    const transaction = pendingTransaction || transactionForm;
    setPendingTransaction(null);
    setCreatingTransaction(true);

    try {
      await onCreateTransaction(receipt.id, transaction);
    } catch (err) {
      setError(err.message || 'Unable to create transaction from receipt.');
    } finally {
      setCreatingTransaction(false);
    }
  }

  async function handleLinkDuplicate() {
    setError('');
    setCreatingTransaction(true);

    try {
      await onLinkTransaction(receipt.id, pendingDuplicate.target.id);
      setPendingDuplicate(null);
      setPendingTransaction(null);
    } catch (err) {
      setError(err.message || 'Unable to link receipt to existing transaction.');
    } finally {
      setCreatingTransaction(false);
    }
  }

  function handleNotDuplicate() {
    setPendingDuplicate(null);
    setPendingTransaction(null);
    setCreatingTransaction(false);
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="section-kicker">Receipt detail</p>
          <h1>{receipt.merchant_name || 'Untitled Receipt'}</h1>
        </div>
        <div className="button-row">
          <button className="secondary-button" disabled={processing || !canPreviewFile} onClick={handleRunOcr}>
            {processing ? 'Processing...' : 'Run OCR'}
          </button>
          <button className="secondary-button" onClick={onBack}>Back to Receipts</button>
        </div>
      </section>

      {error && <p className="form-message error">{error}</p>}

      <section className="receipt-detail-grid">
        <article className="panel">
          {canPreviewFile && !imageFailed ? (
            <img
              alt={receipt.merchant_name || 'Receipt preview'}
              className="receipt-preview-image"
              onError={() => setImageFailed(true)}
              src={receipt.image_url}
            />
          ) : (
            <div className="receipt-detail-fallback">
              <strong>{fileExpired ? 'Receipt file expired' : 'Preview unavailable'}</strong>
              <span>
                {fileExpired
                  ? 'The uploaded file was removed after the 90-day retention window. The receipt entry and report data remain available.'
                  : 'This receipt image cannot be displayed by the browser. If this was a HEIC upload, delete it and upload it again so Dompet Daily can convert it to JPEG first.'}
              </span>
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
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>{category.displayName}</option>
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

      {pendingDuplicate && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="receipt-duplicate-title">
            <div className="modal-header">
              <div>
                <p className="section-kicker">Possible duplicate</p>
                <h2 id="receipt-duplicate-title">Review matching transaction</h2>
              </div>
              <button className="icon-button" aria-label="Close duplicate review" onClick={handleNotDuplicate}>x</button>
            </div>
            <p className="muted-copy">{pendingDuplicate.message}</p>
            <div className="modal-actions">
              <button className="primary-button" disabled={creatingTransaction} onClick={handleLinkDuplicate} type="button">
                Link as same transaction
              </button>
              <button className="secondary-button" disabled={creatingTransaction} onClick={handleKeepBoth} type="button">
                Keep both
              </button>
              <button className="secondary-button" disabled={creatingTransaction} onClick={handleNotDuplicate} type="button">
                Not a duplicate
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function getSuggestedCategoryId(merchantName, categoryOptions) {
  const text = String(merchantName || '').toLowerCase();
  const rules = [
    { pattern: /(coffee|kopi|cafe|restaurant|warung|food|drink|makan)/, category: 'Food & Drink' },
    { pattern: /(grocery|mart|supermarket|fresh|produce)/, category: 'Groceries' },
    { pattern: /(grab|gojek|taxi|parking|fuel|toll|transport)/, category: 'Transport' },
    { pattern: /(doctor|clinic|pharmacy|medicine|health)/, category: 'Health' },
    { pattern: /(netflix|spotify|subscription|cloud|app)/, category: 'Subscription' }
  ];
  const matchedRule = rules.find((rule) => rule.pattern.test(text));

  if (!matchedRule) {
    return '';
  }

  const option = categoryOptions.find((category) => category.displayName.includes(matchedRule.category));
  return option?.id || '';
}
