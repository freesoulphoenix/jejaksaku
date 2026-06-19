import { useCallback, useEffect, useState } from 'react';
import AccountCard from '../components/AccountCard.jsx';
import { createAccount, deleteAccount, getAccounts, updateAccount } from '../services/accountService.js';
import { getTransactions } from '../services/transactionService.js';
import { calculateAccountBalances } from '../utils/balance.js';

const accountTypes = ['Cash', 'Bank', 'E-Wallet', 'PayLater', 'Loan', 'Investment'];

const emptyForm = {
  name: '',
  type: 'Bank',
  balance: 0,
  calculated_balance: 0,
  opening_balance: 0,
  reconciliation_notes: '',
  status: 'active'
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadAccounts = useCallback(async function loadAccounts() {
    setError('');
    setLoading(true);

    try {
      const [accountData, transactionData] = await Promise.all([
        getAccounts(),
        getTransactions()
      ]);
      setAccounts(calculateAccountBalances(accountData, transactionData));
    } catch (err) {
      setError(err.message || 'Unable to load accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (!pendingDeleteId) {
      return undefined;
    }

    function collapseRevealedRow(event) {
      const target = event.target;

      if (!target || typeof target.closest !== 'function') {
        return;
      }

      if (
        target.closest('.apple-edit-minus')
        || target.closest('.apple-edit-delete-reveal')
        || target.closest('.apple-edit-control')
      ) {
        return;
      }

      setPendingDeleteId('');
    }

    document.addEventListener('pointerdown', collapseRevealedRow);
    return () => document.removeEventListener('pointerdown', collapseRevealedRow);
  }, [pendingDeleteId]);

  function openCreateForm() {
    setForm(emptyForm);
    setEditingAccountId(null);
    setPendingDeleteId('');
    setIsFormOpen(true);
  }

  function openEditForm(account) {
    setForm({
      name: account.name,
      type: account.type,
      balance: account.reconciled_balance ?? account.balance,
      calculated_balance: account.calculated_balance ?? account.balance,
      opening_balance: account.opening_balance ?? 0,
      reconciliation_notes: '',
      status: account.status || 'active'
    });
    setEditingAccountId(account.id);
    setPendingDeleteId('');
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
    setPendingDeleteId('');

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
              Current / Reconciled Balance
              <input
                onChange={(event) => updateField('balance', event.target.value)}
                placeholder="0"
                type="number"
                value={form.balance}
              />
            </label>

            <label className="field-group">
              Opening Balance
              <input
                onChange={(event) => updateField('opening_balance', event.target.value)}
                placeholder="0"
                type="number"
                value={form.opening_balance}
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

            {editingAccountId && (
              <label className="field-group span-2">
                Reconciliation Notes
                <input
                  onChange={(event) => updateField('reconciliation_notes', event.target.value)}
                  placeholder="Optional note for this balance update"
                  value={form.reconciliation_notes}
                />
              </label>
            )}

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
            isDeleteRevealed={pendingDeleteId === account.id}
            key={account.id}
            onDelete={handleDelete}
            onEdit={openEditForm}
            onToggleDelete={(accountId) => {
              setPendingDeleteId((currentId) => (
                currentId === accountId ? '' : accountId
              ));
            }}
          />
        ))}
      </section>
    </div>
  );
}
