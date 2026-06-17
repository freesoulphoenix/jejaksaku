import { formatCurrency } from '../utils/format.js';
import { getTransactionAccountName } from '../utils/balance.js';

function getDisplayAmount(transaction) {
  if (getTransactionType(transaction) === 'expense') {
    return -Math.abs(transaction.amount);
  }

  return Number(transaction.amount);
}

function getTransactionType(transaction) {
  return transaction.transaction_type || transaction.type;
}

function getTransactionTitle(transaction) {
  return transaction.description || transaction.title || transaction.categories?.name || 'Transaction';
}

function getTransactionSubtitle(transaction) {
  const category = transaction.categories?.name || transaction.category || getTransactionType(transaction);
  const account = getTransactionAccountName(transaction);
  return `${category} - ${account}`;
}

function formatDisplayDate(date) {
  if (!date) {
    return '';
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export default function TransactionList({ onDelete, onEdit, transactions }) {
  return (
    <div className="transaction-list">
      {transactions.map((transaction) => (
        <article key={transaction.id} className="transaction-row">
          <span className={`transaction-icon ${getTransactionType(transaction)}`}>
            {getTransactionType(transaction) === 'income' ? '+' : getTransactionType(transaction) === 'transfer' ? '>' : '-'}
          </span>
          <div className="transaction-main">
            <strong>{getTransactionTitle(transaction)}</strong>
            <span>{getTransactionSubtitle(transaction)}</span>
            {transaction.project_tags?.name && <span>{transaction.project_tags.name}</span>}
          </div>
          <div className="transaction-meta">
            <strong className={getDisplayAmount(transaction) < 0 ? 'amount-negative' : 'amount-positive'}>
              {getDisplayAmount(transaction) > 0 && getTransactionType(transaction) !== 'transfer' ? '+' : ''}{formatCurrency(getDisplayAmount(transaction))}
            </strong>
            <span>{formatDisplayDate(transaction.transaction_date) || transaction.date}</span>
            {(onDelete || onEdit) && (
              <span className="transaction-actions">
                {onEdit && <button className="text-button" onClick={() => onEdit(transaction)}>Edit</button>}
                {onDelete && <button className="text-button danger" onClick={() => onDelete(transaction)}>Delete</button>}
              </span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
