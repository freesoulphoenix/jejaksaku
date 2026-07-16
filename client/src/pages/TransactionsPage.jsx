import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useRefreshOnResume from '../hooks/useRefreshOnResume.js';
import AddTransactionModal from '../components/AddTransactionModal.jsx';
import BulkEditActivitiesModal from '../components/BulkEditActivitiesModal.jsx';
import TransactionList from '../components/TransactionList.jsx';
import { getAccounts } from '../services/accountService.js';
import { getCategories } from '../services/categoryService.js';
import { getProjectTags } from '../services/projectTagService.js';
import { getCurrentUserProfile } from '../services/userProfileService.js';
import {
  createTransaction,
  deleteTransactions,
  deleteTransaction,
  getTransactions,
  unlinkTransactionFromStatement,
  updateTransaction,
  updateTransactions
} from '../services/transactionService.js';
import {
  findMatchingUnpaidDueForTransaction,
  linkDuePayment
} from '../services/upcomingDueService.js';

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

  if (name === 'search') {
    return (
      <svg {...commonProps}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
    );
  }

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

export default function TransactionsPage({ onNavigate }) {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projectTags, setProjectTags] = useState([]);
  const [defaultAccountId, setDefaultAccountId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchInputRef = useRef(null);

  const loadPageData = useCallback(async function loadPageData(background = false) {
    setError('');
    if (!background) setLoading(true);

    try {
      const [
        transactionsData,
        accountsData,
        categoriesData,
        projectTagsData,
        profileData
      ] = await Promise.all([
        getTransactions(),
        getAccounts(),
        getCategories(),
        getProjectTags(),
        getCurrentUserProfile()
      ]);

      setTransactions(transactionsData);
      setAccounts(accountsData);
      setCategories(categoriesData);
      setProjectTags(projectTagsData);
      setDefaultAccountId(profileData?.default_account_id || '');
    } catch (err) {
      setError(err.message || 'Unable to load transactions.');
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  useRefreshOnResume(() => loadPageData(true));

  useEffect(() => {
    if (!pendingDeleteId) {
      return undefined;
    }

    function handlePointerDown(event) {
      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return;
      }

      if (
        target.closest('.activity-transaction-minus-button')
        || target.closest('.activity-transaction-delete-reveal')
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

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesType =
        typeFilter === 'all' ||
        transaction.transaction_type === typeFilter;

      const haystack = [
        transaction.description,
        transaction.notes,
        transaction.accounts?.name,
        transaction.from_account?.name,
        transaction.to_account?.name,
        transaction.categories?.name,
        transaction.project_tags?.name
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !searchTerm ||
        haystack.includes(searchTerm.toLowerCase());

      return matchesType && matchesSearch;
    });
  }, [searchTerm, transactions, typeFilter]);

  function openCreateModal() {
    setEditingTransaction(null);
    setPendingDeleteId('');
    setIsModalOpen(true);
  }

  function toggleSelectionMode() {
    setPendingDeleteId('');

    if (selectionMode) {
      setSelectedIds([]);
      setSelectionMode(false);
      return;
    }

    setSelectionMode(true);
  }

  function toggleTransactionSelection(transactionId) {
    setSelectedIds((currentIds) => (
      currentIds.includes(transactionId)
        ? currentIds.filter((id) => id !== transactionId)
        : [...currentIds, transactionId]
    ));
  }

  function toggleSelectAllVisible() {
    const visibleIds = filteredTransactions.map((transaction) => transaction.id);
    const allVisibleSelected = visibleIds.length > 0
      && visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((currentIds) => (
      allVisibleSelected
        ? currentIds.filter((id) => !visibleIds.includes(id))
        : [...new Set([...currentIds, ...visibleIds])]
    ));
  }

  function openEditModal(transaction) {
    setEditingTransaction(transaction);
    setPendingDeleteId('');
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingTransaction(null);
    setIsModalOpen(false);
  }

  async function handleSave(form) {
    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, form);
    } else {
      const transaction = await createTransaction(form);
      const matchingDue = await findMatchingUnpaidDueForTransaction(transaction);

      if (matchingDue) {
        const confirmed = window.confirm(`Is this payment for ${matchingDue.title}?`);

        if (confirmed) {
          await linkDuePayment(matchingDue.id, transaction.id);
        }
      }
    }

    await loadPageData();
  }

  async function handleDelete(transaction) {
    setPendingDeleteId('');

    const confirmed = window.confirm('Delete this transaction?');

    if (!confirmed) {
      return;
    }

    setError('');

    try {
      await deleteTransaction(transaction.id);
      await loadPageData();
    } catch (err) {
      setError(err.message || 'Unable to delete transaction.');
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected activit${selectedIds.length === 1 ? 'y' : 'ies'}?`
    );

    if (!confirmed) return;

    setError('');
    setBulkSaving(true);

    try {
      await deleteTransactions(selectedIds);
      setSelectedIds([]);
      setSelectionMode(false);
      await loadPageData();
    } catch (err) {
      setError(err.message || 'Unable to delete selected activities.');
      await loadPageData(true);
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleBulkUpdate(changes) {
    const selectedTransactions = transactions.filter((transaction) => selectedIds.includes(transaction.id));
    await updateTransactions(selectedTransactions, changes);
    setSelectedIds([]);
    setSelectionMode(false);
    await loadPageData();
  }

  async function handleUnlinkStatement(transaction) {
    await unlinkTransactionFromStatement(transaction.id);
    const nextTransactions = await getTransactions();
    setTransactions(nextTransactions);
    const refreshedTransaction = nextTransactions.find((item) => item.id === transaction.id);
    setEditingTransaction(refreshedTransaction || null);
  }

  function clearSearch(event) {
    event?.preventDefault();
    setSearchTerm('');
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }

  return (
    <div className="page-stack activity-page">
      <section className="page-heading activity-page-heading">
        <div>
          <p className="section-kicker">Money movement</p>
          <h1>Activity</h1>
        </div>

        <div className="activity-page-heading-actions">
          <button
            className="secondary-button small activity-select-mode-button"
            onClick={toggleSelectionMode}
            type="button"
          >
            {selectionMode ? 'Done' : 'Select'}
          </button>
          <button
            aria-label="Add transaction"
            className="category-page-add-button activity-page-add-button"
            onClick={openCreateModal}
            type="button"
          >
            <FlatIcon name="plus" />
          </button>
        </div>
      </section>

      {error && <p className="form-message error">{error}</p>}

      <section className="activity-filter-panel">
        <label className="activity-search-field">
          <span className="sr-only">Search transactions</span>
          <input
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search transactions"
            ref={searchInputRef}
            type="search"
            value={searchTerm}
          />
          {searchTerm && (
            <button
              aria-label="Clear search"
              className="activity-search-clear"
              onClick={clearSearch}
              onPointerDown={clearSearch}
              type="button"
            >
              &times;
            </button>
          )}
          <span className="activity-search-icon">
            <FlatIcon name="search" />
          </span>
        </label>

        <label className="activity-type-field">
          <span className="sr-only">Filter transaction type</span>
          <select
            onChange={(event) => setTypeFilter(event.target.value)}
            value={typeFilter}
          >
            <option value="all">All types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
        </label>
      </section>

      <article className="panel activity-list-panel">
        {selectionMode && (
          <div className="activity-selection-toolbar">
            <button className="text-button" onClick={toggleSelectAllVisible} type="button">
              {filteredTransactions.length > 0
                && filteredTransactions.every((transaction) => selectedIds.includes(transaction.id))
                ? 'Deselect visible'
                : 'Select all visible'}
            </button>
            <span>{selectedIds.length} selected</span>
            <div className="activity-selection-actions">
              <button
                className="secondary-button small"
                disabled={selectedIds.length === 0 || bulkSaving}
                onClick={() => setIsBulkEditOpen(true)}
                type="button"
              >
                Edit
              </button>
              <button
                className="secondary-button danger-button small"
                disabled={selectedIds.length === 0 || bulkSaving}
                onClick={handleBulkDelete}
                type="button"
              >
                {bulkSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <p className="muted-copy activity-empty-copy">Loading transactions...</p>
        ) : (
          <TransactionList
            activeDeleteId={pendingDeleteId}
            onDelete={handleDelete}
            onEdit={openEditModal}
            onToggleSelection={toggleTransactionSelection}
            onToggleDelete={(transactionId) => {
              setPendingDeleteId((currentId) => (
                currentId === transactionId ? '' : transactionId
              ));
            }}
            transactions={filteredTransactions}
            selectedIds={selectedIds}
            selectionMode={selectionMode}
            variant="activity"
          />
        )}
      </article>

      {isModalOpen && (
        <AddTransactionModal
          accounts={accounts}
          categories={categories}
          defaultAccountId={defaultAccountId}
          onClose={closeModal}
          onNavigateToImports={() => {
            closeModal();
            onNavigate?.('statements');
          }}
          onSave={handleSave}
          onUnlinkStatement={handleUnlinkStatement}
          projectTags={projectTags}
          transaction={editingTransaction}
        />
      )}

      {isBulkEditOpen && (
        <BulkEditActivitiesModal
          accounts={accounts}
          categories={categories}
          onClose={() => setIsBulkEditOpen(false)}
          onSave={handleBulkUpdate}
          projectTags={projectTags}
          selectedTransactions={transactions.filter((transaction) => selectedIds.includes(transaction.id))}
        />
      )}
    </div>
  );
}
