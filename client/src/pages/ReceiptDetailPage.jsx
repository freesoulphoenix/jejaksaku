import { useMemo, useState } from 'react';
import BoundedDatePicker from '../components/BoundedDatePicker.jsx';
import { findSmartMatch } from '../services/matchingService.js';
import { getCategoryOptions } from '../utils/categoryOptions.js';
import { earliestHistoricalDate, getLocalIsoDate } from '../utils/dateBounds.js';
import { formatCurrency, parseCurrencyInput } from '../utils/format.js';

const today = getLocalIsoDate();

function getReceiptErrorMessage(error, fallback) {
  const message = error?.message || '';

  if (/date\/time field value out of range|invalid input syntax for type date|date format/i.test(message)) {
    return 'Date Format is invalid';
  }

  return message || fallback;
}

function isValidReceiptDate(value) {
  if (!value) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return year >= 2000
    && year <= new Date().getFullYear()
    && date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export default function ReceiptDetailPage({
  accounts = [],
  categories = [],
  defaultAccountId = '',
  onBack,
  onCreateTransaction,
  onLinkTransaction,
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
  const categoryOptions = useMemo(() => getCategoryOptions(categories), [categories]);
  const [transactionForm, setTransactionForm] = useState(() => (
    getSuggestedTransactionFields(receipt, accounts, categoryOptions, projectTags, defaultAccountId)
  ));
  const [saving, setSaving] = useState(false);
  const [creatingTransaction, setCreatingTransaction] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [error, setError] = useState(receipt.ocr_error || '');
  const [pendingDuplicate, setPendingDuplicate] = useState(null);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const fileExpired = Boolean(receipt.file_deleted_at);
  const canPreviewFile = Boolean(receipt.image_url && !fileExpired);

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
      if (!isValidReceiptDate(form.receipt_date)) {
        throw new Error('Date Format is invalid');
      }

      await onSaveReview(receipt.id, form);
    } catch (err) {
      setError(getReceiptErrorMessage(err, 'Unable to save receipt review.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTransaction(event) {
    event.preventDefault();
    setError('');
    setCreatingTransaction(true);

    try {
      if (!isValidReceiptDate(form.receipt_date)) {
        throw new Error('Date Format is invalid');
      }

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
      setError(getReceiptErrorMessage(err, 'Unable to create transaction from receipt.'));
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

  function handleCancelDuplicateReview() {
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
                  : 'This receipt image cannot be displayed by the browser. If this was a HEIC upload, delete it and upload it again so Jejak Saku can convert it to JPEG first.'}
              </span>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Review Extracted Data</h2>
            <span className="summary-pill">{receipt.processing_status || 'pending'}</span>
          </div>

          <form className="form-grid receipt-review-form" onSubmit={handleSave}>
            <label className="field-group span-2">
              Merchant
              <input
                onChange={(event) => updateField('merchant_name', event.target.value)}
                placeholder="Merchant name"
                value={form.merchant_name}
              />
            </label>

            <BoundedDatePicker
              label="Receipt Date"
              maxDate={today}
              minDate={earliestHistoricalDate}
              onChange={(value) => updateField('receipt_date', value)}
              value={form.receipt_date}
            />

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

          {items.length > 0 && (
            <section className="receipt-line-items">
              <h3>Line Items</h3>
              <div className="receipt-item-list">
                {items.map((item) => (
                  <span key={item.id}>
                    <strong>{item.item_name}</strong>
                    {formatCurrency(item.line_total || 0)}
                  </span>
                ))}
              </div>
            </section>
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
              <button className="icon-button" aria-label="Close duplicate review" onClick={handleCancelDuplicateReview}>x</button>
            </div>
            <p className="muted-copy">{pendingDuplicate.message}</p>
            <div className="modal-actions">
              <button className="primary-button" disabled={creatingTransaction} onClick={handleLinkDuplicate} type="button">
                Link as same transaction
              </button>
              <button className="secondary-button" disabled={creatingTransaction} onClick={handleKeepBoth} type="button">
                Keep Both
              </button>
              <button className="secondary-button" disabled={creatingTransaction} onClick={handleCancelDuplicateReview} type="button">
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function normalizeSuggestionText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getSuggestedAccountId(ocrText, accounts) {
  const text = normalizeSuggestionText(ocrText);
  const sortedAccounts = [...accounts].sort((first, second) => second.name.length - first.name.length);

  const matchedAccount = sortedAccounts.find((account) => {
    const accountName = normalizeSuggestionText(account.name);
    return accountName.length >= 3 && new RegExp(`\\b${accountName.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text);
  });

  if (matchedAccount) {
    return matchedAccount.id;
  }

  if (/\b(cash|tunai)\b/i.test(text)) {
    return accounts.find((account) => account.type === 'Cash' || /^cash$/i.test(account.name))?.id || '';
  }

  return '';
}

function getSuggestedCategoryId(value, categoryOptions) {
  const text = normalizeSuggestionText(value);
  const rules = [
    { pattern: /\b(coffee|kopi|cafe|latte|espresso|bakery)\b/, category: 'Coffee & Snacks' },
    { pattern: /\b(restaurant|warung|bakmi|noodle|dining|makan|food court)\b/, category: 'Dining Out' },
    { pattern: /\b(gofood|grabfood|delivery)\b/, category: 'Delivery' },
    { pattern: /\b(supermarket|minimarket|grocery|groceries|indomaret|alfamart|ranch market|lotte mart)\b/, category: 'Household Groceries' },
    { pattern: /\b(fruit|vegetable|produce|sayur|buah)\b/, category: 'Fresh Produce' },
    { pattern: /\b(spbu|shell|pertamina|fuel|bensin)\b/, category: 'Fuel' },
    { pattern: /\b(grab|gojek|taxi|ride hailing)\b/, category: 'Ride Hailing' },
    { pattern: /\b(parking|parkir|toll|tol)\b/, category: 'Parking & Tolls' },
    { pattern: /\b(doctor|clinic|pharmacy|medicine|apotek|hospital)\b/, category: 'Doctor & Medicine' },
    { pattern: /\b(netflix|spotify|streaming)\b/, category: 'Media Streaming' },
    { pattern: /\b(clothing|fashion|apparel|shirt|shirts|dress|dresses|pants|jeans|jacket|jackets|shoes|shoe|sneakers|sneaker|bag|bags|watch|watches|accessories|accessory|uniqlo|zara|max\s*fashion|h\s*&?\s*m|hm)\b/, category: 'Fashion' },
    { pattern: /\b(hotel|resort)\b/, category: 'Hotel' },
    { pattern: /\b(flight|airline)\b/, category: 'Flight' }
  ];
  const matchedRule = rules.find((rule) => rule.pattern.test(text));

  if (!matchedRule) {
    return '';
  }

  const option = categoryOptions.find((category) => (
    category.name.toLowerCase() === matchedRule.category.toLowerCase()
    || (matchedRule.category === 'Fashion' && category.name.toLowerCase() === 'clothing')
  ));
  return option?.id || '';
}

function getSuggestedTransactionFields(receipt, accounts, categoryOptions, projectTags, defaultAccountId = '') {
  const suggestionText = [receipt.merchant_name, receipt.ocr_text].filter(Boolean).join(' ');
  const categoryId = getSuggestedCategoryId(suggestionText, categoryOptions);
  const dailyLifeTag = projectTags.find((tag) => /^daily life$/i.test(tag.name));

  return {
    account_id: getSuggestedAccountId(receipt.ocr_text, accounts) || defaultAccountId || '',
    category_id: categoryId,
    project_tag_id: categoryId ? dailyLifeTag?.id || '' : ''
  };
}
