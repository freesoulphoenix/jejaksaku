import { useCallback, useEffect, useMemo, useState } from 'react';
import useRefreshOnResume from '../hooks/useRefreshOnResume.js';
import AccountCard from '../components/AccountCard.jsx';
import {
  createAccount,
  deleteAccount,
  getAccounts,
  updateAccount,
  updateAccountOrder
} from '../services/accountService.js';
import { getTransactions } from '../services/transactionService.js';
import { calculateAccountBalances } from '../utils/balance.js';
import { creditFacilityTypes } from '../utils/creditFacility.js';

const accountTypes = ['Cash', 'Bank', 'E-Wallet', 'Credit Card', 'PayLater', 'Loan', 'Investment'];

const emptyForm = {
  name: '',
  type: 'Bank',
  balance: 0,
  calculated_balance: 0,
  opening_balance: 0,
  reconciliation_notes: '',
  status: 'active',
  credit_limit: '',
  credit_alert_enabled: true,
  credit_alert_threshold: 75,
  billing_day: '',
  payment_due_day: ''
};

function FlatIcon({ name }) {
  const commonProps = {
    'aria-hidden': 'true',
    fill: 'none',
    height: '18',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: '2',
    viewBox: '0 0 24 24',
    width: '18'
  };

  if (name === 'plus') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    );
  }

  return null;
}

function sortAccounts(accounts) {
  return [...accounts].sort((a, b) => {
    const aOrder = Number.isFinite(Number(a.sort_order))
      ? Number(a.sort_order)
      : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(Number(b.sort_order))
      ? Number(b.sort_order)
      : Number.MAX_SAFE_INTEGER;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return a.name.localeCompare(b.name);
  });
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [draggingAccountId, setDraggingAccountId] = useState('');
  const [dragOverAccountId, setDragOverAccountId] = useState('');
  const [isSortingAccount, setIsSortingAccount] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const accountsByType = useMemo(() => {
    return accountTypes.reduce((groups, type) => {
      groups[type] = sortAccounts(accounts.filter((account) => account.type === type));
      return groups;
    }, {});
  }, [accounts]);

  const loadAccounts = useCallback(async function loadAccounts(background = false) {
    setError('');
    if (!background) setLoading(true);

    try {
      const [accountData, transactionData] = await Promise.all([
        getAccounts(),
        getTransactions()
      ]);

      setAccounts(calculateAccountBalances(accountData, transactionData));
    } catch (err) {
      setError(err.message || 'Unable to load accounts.');
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useRefreshOnResume(() => loadAccounts(true));

  useEffect(() => {
    if (!pendingDeleteId) {
      return undefined;
    }

    function handlePointerDown(event) {
      const target = event.target;

      if (!target || typeof target.closest !== 'function') {
        return;
      }

      if (
        target.closest('.account-minus-button')
        || target.closest('.account-delete-reveal')
      ) {
        return;
      }

      setPendingDeleteId('');
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
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
      balance: creditFacilityTypes.has(account.type)
        ? Math.abs(Number(account.reconciled_balance ?? account.balance ?? 0))
        : account.reconciled_balance ?? account.balance,
      calculated_balance: account.calculated_balance ?? account.balance,
      opening_balance: creditFacilityTypes.has(account.type)
        ? Math.abs(Number(account.opening_balance ?? 0))
        : account.opening_balance ?? 0,
      reconciliation_notes: '',
      status: account.status || 'active',
      credit_limit: account.credit_limit ?? '',
      credit_alert_enabled: account.credit_alert_enabled !== false,
      credit_alert_threshold: account.credit_alert_threshold ?? 75,
      billing_day: account.billing_day ?? '',
      payment_due_day: account.payment_due_day ?? ''
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

  const isCreditFacilityForm = creditFacilityTypes.has(form.type);

  async function handleDelete(account) {
    setPendingDeleteId('');

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

  function handleAccountDragStart(event, account) {
    if (isSortingAccount) {
      event.preventDefault();
      return;
    }

    setPendingDeleteId('');
    setDraggingAccountId(account.id);
    setDragOverAccountId('');

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', account.id);
  }

  function handleAccountDragOver(event, account) {
    event.preventDefault();

    const sourceAccount = accounts.find((item) => item.id === draggingAccountId);

    if (
      !sourceAccount
      || sourceAccount.id === account.id
      || sourceAccount.type !== account.type
    ) {
      return;
    }

    setDragOverAccountId(account.id);
  }

  async function handleAccountDrop(event, targetAccount, rows) {
    event.preventDefault();

    const sourceId = event.dataTransfer.getData('text/plain') || draggingAccountId;
    const sourceAccount = accounts.find((item) => item.id === sourceId);

    if (
      !sourceAccount
      || sourceAccount.type !== targetAccount.type
      || sourceAccount.id === targetAccount.id
    ) {
      setDraggingAccountId('');
      setDragOverAccountId('');
      return;
    }

    const sourceIndex = rows.findIndex((item) => item.id === sourceId);
    const targetIndex = rows.findIndex((item) => item.id === targetAccount.id);

    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggingAccountId('');
      setDragOverAccountId('');
      return;
    }

    const reorderedRows = [...rows];
    const [movedAccount] = reorderedRows.splice(sourceIndex, 1);
    reorderedRows.splice(targetIndex, 0, movedAccount);

    setIsSortingAccount(true);
    setError('');

    try {
      await updateAccountOrder(reorderedRows);
      await loadAccounts();
    } catch (err) {
      setError(err.message || 'Unable to reorder accounts.');
      await loadAccounts();
    } finally {
      setIsSortingAccount(false);
      setDraggingAccountId('');
      setDragOverAccountId('');
    }
  }

  function handleAccountDragEnd() {
    setDraggingAccountId('');
    setDragOverAccountId('');
  }

  return (
    <div className="page-stack">
      <section className="page-heading account-page-heading">
        <div>
          <p className="section-kicker">Wallets and liabilities</p>
          <h1>Accounts</h1>
        </div>

        <button
          aria-label="Add account"
          className="category-page-add-button account-page-add-button"
          onClick={openCreateForm}
          type="button"
        >
          <FlatIcon name="plus" />
        </button>
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
              {isCreditFacilityForm ? 'Current Amount Owed' : 'Current / Reconciled Balance'}
              <input
                onChange={(event) => updateField('balance', event.target.value)}
                placeholder="0"
                type="number"
                value={form.balance}
              />
            </label>

            <label className="field-group">
              {isCreditFacilityForm ? 'Opening Amount Owed' : 'Opening Balance'}
              <input
                onChange={(event) => updateField('opening_balance', event.target.value)}
                placeholder="0"
                type="number"
                value={form.opening_balance}
              />
            </label>

            {isCreditFacilityForm && (
              <>
                <label className="field-group">
                  Credit Limit
                  <input
                    min="0"
                    onChange={(event) => updateField('credit_limit', event.target.value)}
                    placeholder="10000000"
                    type="number"
                    value={form.credit_limit}
                  />
                </label>

                <label className="field-group">
                  Alert Threshold (%)
                  <input
                    max="100"
                    min="1"
                    onChange={(event) => updateField('credit_alert_threshold', event.target.value)}
                    type="number"
                    value={form.credit_alert_threshold}
                  />
                </label>

                <label className="field-group">
                  Billing Day
                  <input
                    max="31"
                    min="1"
                    onChange={(event) => updateField('billing_day', event.target.value)}
                    placeholder="20"
                    type="number"
                    value={form.billing_day}
                  />
                </label>

                <label className="field-group">
                  Payment Due Day
                  <input
                    max="31"
                    min="1"
                    onChange={(event) => updateField('payment_due_day', event.target.value)}
                    placeholder="10"
                    type="number"
                    value={form.payment_due_day}
                  />
                </label>

                <label className="checkbox-field span-2">
                  <input
                    checked={form.credit_alert_enabled}
                    onChange={(event) => updateField('credit_alert_enabled', event.target.checked)}
                    type="checkbox"
                  />
                  Alert me when utilization crosses the threshold
                </label>
              </>
            )}

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

      {!loading && accounts.length === 0 && (
        <section className="empty-state">
          <h2>No accounts yet</h2>
          <p>Add your first cash, bank, e-wallet, or investment account.</p>
        </section>
      )}

      {!loading && accounts.length > 0 && (
        <section className="account-list">
          {accountTypes.map((type) => {
            const rows = accountsByType[type];

            if (rows.length === 0) {
              return null;
            }

            return (
              <section className="account-type-group" key={type}>
                <h2 className="account-type-heading">{type}</h2>

                <div className="account-flat-list is-editing">
                  {rows.map((account) => (
                    <AccountCard
                      account={account}
                      dragOver={dragOverAccountId === account.id}
                      dragging={draggingAccountId === account.id}
                      isDeleteRevealed={pendingDeleteId === account.id}
                      isSorting={isSortingAccount}
                      key={account.id}
                      onDelete={handleDelete}
                      onDragEnd={handleAccountDragEnd}
                      onDragOver={handleAccountDragOver}
                      onDragStart={handleAccountDragStart}
                      onDrop={handleAccountDrop}
                      onEdit={openEditForm}
                      onToggleDelete={(accountId) => {
                        setPendingDeleteId((currentId) => (
                          currentId === accountId ? '' : accountId
                        ));
                      }}
                      rows={rows}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </section>
      )}
    </div>
  );
}
