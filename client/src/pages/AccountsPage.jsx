import { useEffect, useState } from 'react';
import AccountCard from '../components/AccountCard.jsx';
import { createAccount, deleteAccount, getAccounts, updateAccount } from '../services/accountService.js';

const accountTypes = ['Cash', 'Bank', 'E-Wallet', 'PayLater', 'Loan', 'Investment'];

const emptyForm = {
  name: '',
  type: 'Bank',
  balance: 0,
  status: 'active'
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadAccounts() {
    setError('');
    setLoading(true);

    try {
      const data = await getAccounts();
      setAccounts(data);
    } catch (err) {
      setError(err.message || 'Unable to load accounts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  function openCreateForm() {
    setForm(emptyForm);
    setEditingAccountId(null);
    setIsFormOpen(true);
  }

  function openEditForm(account) {
    setForm({
      name: account.name,
      type: account.type,
      balance: account.balance,
      status: account.status || 'active'
    });
    setEditingAccountId(account.id);
    setIsFormOpen(true);
  }

  function closeForm() {
    setForm(emptyForm);
    setEditingAccountId(null);
    setIsFormOpen(false);
  }

  function updateField(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (editingAccountId) {
        await updateAccount(editingAccountId, form);
      } else {
        await createAccount(form);
      }

      closeForm();
      await loadAccounts();
    } catch (err) {
      setError(err.message || 'Unable to save account.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(account) {
    const confirmed = window.confirm(`Delete ${account.name}?`);

    if (!confirmed) {
      return;
    }

    setError('');

    try {
      await deleteAccount(account.id);
      await loadAccounts();
    } catch (err) {
      setError(err.message || 'Unable to delete account.');
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="section-kicker">Wallets and liabilities</p>
          <h1>Accounts</h1>
        </div>
        <button className="primary-button" onClick={openCreateForm}>Add Account</button>
      </section>

      {error && <p className="form-message error">{error}</p>}

      {isFormOpen && (
        <section className="panel">
          <div className="panel-header">
            <h2>{editingAccountId ? 'Edit Account' : 'Add Account'}</h2>
            <button className="text-button" onClick={closeForm}>Cancel</button>
          </div>

          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="field-group">
              Name
              <input
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="BCA"
                required
                value={form.name}
              />
            </label>

            <label className="field-group">
              Type
              <select
                onChange={(event) => updateField('type', event.target.value)}
                required
                value={form.type}
              >
                {accountTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>

            <label className="field-group">
              Balance
              <input
                onChange={(event) => updateField('balance', event.target.value)}
                placeholder="0"
                type="number"
                value={form.balance}
              />
            </label>

            <label className="field-group">
              Status
              <select
                onChange={(event) => updateField('status', event.target.value)}
                value={form.status}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <div className="modal-actions span-2">
              <button className="secondary-button" onClick={closeForm} type="button">Cancel</button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? 'Saving...' : 'Save Account'}
              </button>
            </div>
          </form>
        </section>
      )}

      {loading && <p className="muted-copy">Loading accounts...</p>}

      <section className="account-grid">
        {accounts.map((account) => (
          <AccountCard
            account={account}
            key={account.id}
            onDelete={handleDelete}
            onEdit={openEditForm}
          />
        ))}
      </section>
    </div>
  );
}
