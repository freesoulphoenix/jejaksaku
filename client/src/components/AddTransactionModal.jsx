import { useMemo, useState } from 'react';
import BoundedDatePicker from './BoundedDatePicker.jsx';
import { getCategoryOptions } from '../utils/categoryOptions.js';
import { earliestHistoricalDate, getLocalIsoDate } from '../utils/dateBounds.js';

const today = getLocalIsoDate();

function LinkIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.15 1.15" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.15-1.15" />
    </svg>
  );
}

function getInitialForm(transaction, defaultAccountId = '') {
  return {
    transaction_type: transaction?.transaction_type || 'expense',
    financial_activity: transaction?.financial_activity || 'standard',
    amount: transaction?.amount || 0,
    account_id: transaction?.account_id || (!transaction ? defaultAccountId : ''),
    from_account_id: transaction?.from_account_id || transaction?.account_id || (!transaction ? defaultAccountId : ''),
    to_account_id: transaction?.to_account_id || '',
    category_id: transaction?.category_id || '',
    project_tag_id: transaction?.project_tag_id || '',
    receipt_id: transaction?.receipt_id || null,
    imported_transaction_id: transaction?.imported_transaction_id || null,
    transaction_date: transaction?.transaction_date || today,
    description: transaction?.description || '',
    transfer_fee: transaction?.transfer_fee || 0,
    transfer_purpose: transaction?.transfer_purpose || '',
    notes: transaction?.notes || ''
  };
}

export default function AddTransactionModal({
  accounts = [],
  categories = [],
  projectTags = [],
  transaction = null,
  defaultAccountId = '',
  onClose,
  onNavigateToImports,
  onSave,
  onUnlinkStatement
}) {
  const [form, setForm] = useState(() => getInitialForm(transaction, defaultAccountId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [linkMessage, setLinkMessage] = useState('');
  const isTransfer = form.transaction_type === 'transfer';
  const categoryOptions = useMemo(() => (
    getCategoryOptions(categories, form.transaction_type === 'transfer' ? null : form.transaction_type)
  ), [categories, form.transaction_type]);

  function updateField(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
      ...(field === 'transaction_type' && value === 'transfer' ? { category_id: '' } : {})
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!onSave) {
      onClose();
      return;
    }

    setError('');
    setSaving(true);

    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to save transaction.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlinkStatement() {
    if (!onUnlinkStatement || !transaction) {
      return;
    }

    const confirmed = window.confirm(
      'Unlink this bank statement entry? The transaction will remain, and the statement row will return to the review queue.'
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setLinkMessage('');
    setSaving(true);

    try {
      await onUnlinkStatement(transaction);
      setForm((currentForm) => ({
        ...currentForm,
        imported_transaction_id: null
      }));
      setLinkMessage('Statement entry unlinked. The transaction was kept.');
    } catch (err) {
      setError(err.message || 'Unable to unlink statement entry.');
    } finally {
      setSaving(false);
    }
  }

  const importedRow = transaction?.imported_transaction;
  const statementImport = importedRow?.statement_import;
  const isStatementMatch = importedRow?.import_status === 'duplicate';
  const hasReceipt = Boolean(transaction?.receipt_id);
  const sourceTitle = isStatementMatch
    ? (hasReceipt ? 'Receipt and statement linked' : 'Statement entry linked')
    : importedRow
      ? 'Imported from statement'
      : hasReceipt
        ? 'Created from receipt'
        : '';

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="add-transaction-title">
        <div className="modal-header">
          <div>
            <p className="section-kicker">{transaction ? 'Edit activity' : 'New activity'}</p>
            <h2 id="add-transaction-title">{transaction ? 'Edit Transaction' : 'Add Transaction'}</h2>
          </div>
          <button className="icon-button" aria-label="Close modal" onClick={onClose}>x</button>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          {error && <p className="form-message error span-2">{error}</p>}
          {linkMessage && <p className="form-message success span-2">{linkMessage}</p>}
          {transaction && sourceTitle && (
            <section className="transaction-link-panel span-2" aria-label="Transaction source">
              <div className="transaction-link-heading">
                <span className="transaction-link-icon"><LinkIcon /></span>
                <div>
                  <strong>{sourceTitle}</strong>
                  <small>
                    {statementImport?.bank_name || statementImport?.file_name || transaction.receipt?.merchant_name || 'Source record available'}
                  </small>
                </div>
              </div>
              <div className="transaction-link-actions">
                {importedRow && onNavigateToImports && (
                  <button className="text-button" onClick={onNavigateToImports} type="button">Open Imports</button>
                )}
                {isStatementMatch && onUnlinkStatement && (
                  <button className="text-button danger" disabled={saving} onClick={handleUnlinkStatement} type="button">Unlink</button>
                )}
              </div>
            </section>
          )}
          <label className="field-group">
            Type
            <select
              onChange={(event) => updateField('transaction_type', event.target.value)}
              value={form.transaction_type}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>
          </label>

          <label className="field-group">
            Activity
            <select
              onChange={(event) => updateField('financial_activity', event.target.value)}
              value={form.financial_activity}
            >
              <option value="standard">Standard</option>
              <option value="purchase">Purchase</option>
              <option value="payment">Credit payment</option>
              <option value="refund">Refund</option>
              <option value="fee">Fee / interest</option>
              <option value="cash_advance">Cash advance</option>
              <option value="installment">Installment</option>
            </select>
          </label>
          <label className="field-group">
            Amount
            <input
              onChange={(event) => updateField('amount', event.target.value)}
              placeholder="0"
              required
              type="number"
              value={form.amount}
            />
          </label>
          {isTransfer ? (
            <>
              <label className="field-group">
                From Account
                <select
                  onChange={(event) => updateField('from_account_id', event.target.value)}
                  required
                  value={form.from_account_id}
                >
                  <option value="">Select source account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                To Account
                <select
                  onChange={(event) => updateField('to_account_id', event.target.value)}
                  required
                  value={form.to_account_id}
                >
                  <option value="">Select destination account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                Transfer Purpose
                <input
                  onChange={(event) => updateField('transfer_purpose', event.target.value)}
                  placeholder="Top up, savings, repayment"
                  value={form.transfer_purpose}
                />
              </label>
              <label className="field-group">
                Transfer Fee
                <input
                  min="0"
                  onChange={(event) => updateField('transfer_fee', event.target.value)}
                  placeholder="0"
                  type="number"
                  value={form.transfer_fee}
                />
              </label>
            </>
          ) : (
            <>
              <label className="field-group">
                Account
                <select
                  onChange={(event) => updateField('account_id', event.target.value)}
                  required
                  value={form.account_id}
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
                  onChange={(event) => updateField('category_id', event.target.value)}
                  required
                  value={form.category_id}
                >
                  <option value="">Select category</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>{category.displayName}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="field-group">
            Project Tag
            <select
              onChange={(event) => updateField('project_tag_id', event.target.value)}
              value={form.project_tag_id}
            >
              <option value="">Select project tag</option>
              {projectTags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </label>
          <BoundedDatePicker
            label="Date"
            maxDate={today}
            minDate={earliestHistoricalDate}
            onChange={(value) => updateField('transaction_date', value)}
            required
            value={form.transaction_date}
          />
          <label className="field-group span-2">
            Description
            <input
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="Kopi Kenangan"
              value={form.description}
            />
          </label>
          <label className="field-group span-2">
            Notes
            <textarea
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Add a short note"
              rows="3"
              value={form.notes}
            />
          </label>
          <div className="modal-actions span-2">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
