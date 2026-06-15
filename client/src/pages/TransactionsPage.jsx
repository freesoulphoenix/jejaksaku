import { useEffect, useMemo, useState } from 'react';
import AddTransactionModal from '../components/AddTransactionModal.jsx';
import TransactionList from '../components/TransactionList.jsx';
import { getAccounts } from '../services/accountService.js';
import { getCategories } from '../services/categoryService.js';
import { getProjectTags } from '../services/projectTagService.js';
import { createTransaction, deleteTransaction, getTransactions, updateTransaction } from '../services/transactionService.js';
import { findMatchingUnpaidDueForTransaction, linkDuePayment } from '../services/upcomingDueService.js';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projectTags, setProjectTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadPageData() {
    setError('');
    setLoading(true);

    try {
      const [transactionsData, accountsData, categoriesData, projectTagsData] = await Promise.all([
        getTransactions(),
        getAccounts(),
        getCategories(),
        getProjectTags()
      ]);

      setTransactions(transactionsData);
      setAccounts(accountsData);
      setCategories(categoriesData);
      setProjectTags(projectTagsData);
    } catch (err) {
      setError(err.message || 'Unable to load transactions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesType = typeFilter === 'all' || transaction.transaction_type === typeFilter;
      const haystack = [
        transaction.description,
        transaction.notes,
        transaction.accounts?.name,
        transaction.categories?.name,
        transaction.project_tags?.name
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());

      return matchesType && matchesSearch;
    });
  }, [searchTerm, transactions, typeFilter]);

  function openCreateModal() {
    setEditingTransaction(null);
    setIsModalOpen(true);
  }

  function openEditModal(transaction) {
    setEditingTransaction(transaction);
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

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="section-kicker">Money movement</p>
          <h1>Activity</h1>
        </div>
        <button className="primary-button" onClick={openCreateModal}>Add Transaction</button>
      </section>

      {error && <p className="form-message error">{error}</p>}

      <section className="filter-panel">
        <input
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search transactions"
          type="search"
          value={searchTerm}
        />
        <select onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
          <option value="all">All types</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="transfer">Transfer</option>
        </select>
      </section>

      <article className="panel">
        {loading ? (
          <p className="muted-copy">Loading transactions...</p>
        ) : (
          <TransactionList
            onDelete={handleDelete}
            onEdit={openEditModal}
            transactions={filteredTransactions}
          />
        )}
      </article>

      {isModalOpen && (
        <AddTransactionModal
          accounts={accounts}
          categories={categories}
          onClose={closeModal}
          onSave={handleSave}
          projectTags={projectTags}
          transaction={editingTransaction}
        />
      )}
    </div>
  );
}
