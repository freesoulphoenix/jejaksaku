import { useState } from 'react';

const today = new Date().toISOString().slice(0, 10);

function getInitialForm(transaction) {
  return {
    transaction_type: transaction?.transaction_type || 'expense',
    amount: transaction?.amount || 0,
    account_id: transaction?.account_id || '',
    category_id: transaction?.category_id || '',
    project_tag_id: transaction?.project_tag_id || '',
    transaction_date: transaction?.transaction_date || today,
    description: transaction?.description || '',
    notes: transaction?.notes || ''
  };
}

export default function AddTransactionModal({
  accounts = [],
  categories = [],
  projectTags = [],
  transaction = null,
  onClose,
  onSave
}) {
  const [form, setForm] = useState(() => getInitialForm(transaction));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateField(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
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
            Amount
            <input
              onChange={(event) => updateField('amount', event.target.value)}
              placeholder="0"
              required
              type="number"
              value={form.amount}
            />
          </label>
          <label className="field-group">
            Account
            <select
              onChange={(event) => updateField('account_id', event.target.value)}
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
              value={form.category_id}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
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
          <label className="field-group">
            Date
            <input
              onChange={(event) => updateField('transaction_date', event.target.value)}
              required
              type="date"
              value={form.transaction_date}
            />
          </label>
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
