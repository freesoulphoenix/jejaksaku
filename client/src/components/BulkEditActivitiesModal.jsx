import { useMemo, useState } from 'react';
import { getCategoryOptions } from '../utils/categoryOptions.js';

const unchangedValue = '__unchanged__';
const clearValue = '__clear__';

export default function BulkEditActivitiesModal({
  accounts = [],
  categories = [],
  projectTags = [],
  selectedTransactions = [],
  onClose,
  onSave
}) {
  const [form, setForm] = useState({
    account_id: unchangedValue,
    category_id: unchangedValue,
    project_tag_id: unchangedValue
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const categoryOptions = useMemo(() => getCategoryOptions(categories, null), [categories]);
  const hasTransfers = selectedTransactions.some((transaction) => transaction.transaction_type === 'transfer');
  const hasCategorizedTransactions = selectedTransactions.some((transaction) => transaction.transaction_type !== 'transfer');

  function updateField(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const changes = {};

    if (form.account_id !== unchangedValue) {
      changes.account_id = form.account_id;
    }

    if (form.category_id !== unchangedValue) {
      changes.category_id = form.category_id;
    }

    if (form.project_tag_id !== unchangedValue) {
      changes.project_tag_id = form.project_tag_id === clearValue ? null : form.project_tag_id;
    }

    if (Object.keys(changes).length === 0) {
      setError('Choose at least one field to update.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      await onSave(changes);
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to update selected activities.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="bulk-edit-activities-title"
        aria-modal="true"
        className="modal-panel activity-bulk-edit-modal"
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <p className="section-kicker">Bulk edit</p>
            <h2 id="bulk-edit-activities-title">
              Edit {selectedTransactions.length} activities
            </h2>
          </div>
          <button aria-label="Close modal" className="icon-button" onClick={onClose} type="button">x</button>
        </div>

        <p className="muted-copy activity-bulk-edit-copy">
          Only the fields you choose will be changed. All other activity details stay as they are.
        </p>

        <form className="form-grid" onSubmit={handleSubmit}>
          {error && <p className="form-message error span-2">{error}</p>}

          <label className="field-group">
            Account source
            <select
              onChange={(event) => updateField('account_id', event.target.value)}
              value={form.account_id}
            >
              <option value={unchangedValue}>Keep current accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
            {hasTransfers && <small>For transfers, this changes the From Account.</small>}
          </label>

          <label className="field-group">
            Project tag
            <select
              onChange={(event) => updateField('project_tag_id', event.target.value)}
              value={form.project_tag_id}
            >
              <option value={unchangedValue}>Keep current project tags</option>
              <option value={clearValue}>Remove project tag</option>
              {projectTags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </label>

          <label className="field-group span-2">
            Category
            <select
              disabled={!hasCategorizedTransactions}
              onChange={(event) => updateField('category_id', event.target.value)}
              value={form.category_id}
            >
              <option value={unchangedValue}>Keep current categories</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.displayName}</option>
              ))}
            </select>
            <small>
              {hasCategorizedTransactions
                ? 'Category changes apply to expenses and income; transfers are left unchanged.'
                : 'Transfers do not use categories.'}
            </small>
          </label>

          <div className="modal-actions span-2">
            <button className="secondary-button" disabled={saving} onClick={onClose} type="button">Cancel</button>
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Updating...' : 'Update selected'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
