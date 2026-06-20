import { useEffect, useState } from 'react';
import { formatCurrency } from '../utils/format.js';
import { getTransactionAccountName } from '../utils/balance.js';

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

  if (name === 'edit') {
    return (
      <svg {...commonProps}>
        <path d="M12 20h9" />
        <path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z" />
      </svg>
    );
  }

  if (name === 'grip') {
    return (
      <svg {...commonProps}>
        <path d="M7 8h10" />
        <path d="M7 12h10" />
        <path d="M7 16h10" />
      </svg>
    );
  }

  if (name === 'minus') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="8" fill="currentColor" stroke="none" />
        <path d="M8.5 12h7" stroke="#fff" />
      </svg>
    );
  }

  if (name === 'trash') {
    return (
      <svg {...commonProps}>
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M6 7l1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
      </svg>
    );
  }

  if (name === 'link') {
    return (
      <svg {...commonProps}>
        <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.15 1.15" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.15-1.15" />
      </svg>
    );
  }

  return null;
}

function getTransactionType(transaction) {
  return transaction.transaction_type || transaction.type;
}

function getDisplayAmount(transaction) {
  if (getTransactionType(transaction) === 'expense') {
    return -Math.abs(Number(transaction.amount || 0));
  }

  return Number(transaction.amount || 0);
}

function getTransactionTitle(transaction) {
  return (
    transaction.description ||
    transaction.title ||
    transaction.categories?.name ||
    'Transaction'
  );
}

function getTransactionSubtitle(transaction) {
  const category =
    transaction.categories?.name ||
    transaction.category ||
    getTransactionType(transaction);
  const account = getTransactionAccountName(transaction);

  return [category, account].filter(Boolean).join(' - ');
}

function getTransactionLinkLabel(transaction) {
  if (transaction.imported_transaction?.import_status === 'duplicate') {
    return transaction.receipt_id ? 'Receipt + statement linked' : 'Statement linked';
  }

  if (transaction.imported_transaction_id) {
    return 'Statement import';
  }

  if (transaction.receipt_id) {
    return 'Receipt';
  }

  return '';
}

function TransactionLinkBadge({ className = '', label }) {
  return (
    <span className={`activity-link-badge ${className}`.trim()} title={label}>
      <FlatIcon name="link" />
      {label}
    </span>
  );
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

function getAmountLabel(transaction) {
  const type = getTransactionType(transaction);
  const amount = Math.abs(Number(transaction.amount || 0));

  if (type === 'expense') {
    return `-${formatCurrency(amount)}`;
  }

  if (type === 'income') {
    return `+${formatCurrency(amount)}`;
  }

  return formatCurrency(amount);
}

function getAmountClassName(transaction) {
  const type = getTransactionType(transaction);

  if (type === 'expense') {
    return 'amount-negative';
  }

  if (type === 'income') {
    return 'amount-positive';
  }

  return 'amount-transfer';
}

function ActivityTransactionList({
  activeDeleteId = '',
  onDelete,
  onEdit,
  onToggleDelete,
  transactions
}) {
  if (transactions.length === 0) {
    return (
      <p className="muted-copy activity-empty-copy">
        No transactions match this filter.
      </p>
    );
  }

  return (
    <div className="activity-transaction-list">
      {transactions.map((transaction) => {
        const subtitle = [
          formatDisplayDate(transaction.transaction_date) || transaction.date,
          getTransactionSubtitle(transaction),
          transaction.project_tags?.name
        ]
          .filter(Boolean)
          .join(' - ');

        const rowClassName = [
          'activity-transaction-row',
          activeDeleteId === transaction.id ? 'reveal-delete' : ''
        ]
          .filter(Boolean)
          .join(' ');
        const linkLabel = getTransactionLinkLabel(transaction);

        return (
          <div className={rowClassName} key={transaction.id}>
            <div className="activity-transaction-row-slide">
              <button
                aria-label={
                  activeDeleteId === transaction.id
                    ? `Hide delete for ${getTransactionTitle(transaction)}`
                    : `Show delete for ${getTransactionTitle(transaction)}`
                }
                className="activity-transaction-minus-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleDelete?.(transaction.id);
                }}
                type="button"
              >
                <FlatIcon name="minus" />
              </button>

              <div className="activity-transaction-main">
                <div className="activity-transaction-title-row">
                  <strong>{getTransactionTitle(transaction)}</strong>
                  {linkLabel && (
                    <TransactionLinkBadge className="activity-link-badge-desktop" label={linkLabel} />
                  )}
                </div>
                <small>{subtitle}</small>
              </div>

              <div className="activity-transaction-tools">
                <strong
                  className={[
                    'activity-transaction-amount',
                    getAmountClassName(transaction)
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {getAmountLabel(transaction)}
                </strong>

                <button
                  aria-label={`Edit ${getTransactionTitle(transaction)}`}
                  className="activity-transaction-icon-button"
                  onClick={() => onEdit?.(transaction)}
                  type="button"
                >
                  <FlatIcon name="edit" />
                </button>

                <span
                  aria-hidden="true"
                  className="activity-transaction-grip"
                  title="Transactions are ordered by date"
                >
                  <FlatIcon name="grip" />
                </span>

                {linkLabel && (
                  <TransactionLinkBadge className="activity-link-badge-mobile" label={linkLabel} />
                )}
              </div>
            </div>

            <button
              aria-label={`Delete ${getTransactionTitle(transaction)}`}
              className="activity-transaction-delete-reveal"
              onClick={() => onDelete?.(transaction)}
              type="button"
            >
              <FlatIcon name="trash" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function DashboardTransactionList({
  activeDeleteId,
  onDelete,
  onEdit,
  onRevealDelete,
  revealDeleteMode = false,
  transactions
}) {
  const [internalActiveDeleteId, setInternalActiveDeleteId] = useState('');
  const currentActiveDeleteId = activeDeleteId ?? internalActiveDeleteId;

  useEffect(() => {
    if (!revealDeleteMode || activeDeleteId !== undefined || !internalActiveDeleteId) {
      return undefined;
    }

    function collapseRevealedRow(event) {
      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return;
      }

      if (
        target.closest('.apple-edit-minus')
        || target.closest('.apple-edit-delete-reveal')
        || target.closest('.apple-edit-control')
      ) {
        return;
      }

      setInternalActiveDeleteId('');
    }

    document.addEventListener('pointerdown', collapseRevealedRow);
    return () => document.removeEventListener('pointerdown', collapseRevealedRow);
  }, [activeDeleteId, internalActiveDeleteId, revealDeleteMode]);

  function handleRevealDelete(transaction) {
    if (onRevealDelete) {
      onRevealDelete(transaction);
      return;
    }

    setInternalActiveDeleteId((currentId) => (
      currentId === transaction.id ? '' : transaction.id
    ));
  }

  function handleDelete(transaction) {
    if (activeDeleteId === undefined) {
      setInternalActiveDeleteId('');
    }

    onDelete?.(transaction);
  }

  return (
    <div className="transaction-list">
      {transactions.map((transaction) => {
        const row = (
          <article className="transaction-row">
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
                {getDisplayAmount(transaction) > 0 && getTransactionType(transaction) !== 'transfer' ? '+' : ''}
                {formatCurrency(getDisplayAmount(transaction))}
              </strong>
              <span>{formatDisplayDate(transaction.transaction_date) || transaction.date}</span>
              {(onDelete || onEdit) && !revealDeleteMode && (
                <span className="transaction-actions">
                  {onEdit && <button className="text-button" onClick={() => onEdit(transaction)}>Edit</button>}
                  {onDelete && <button className="text-button danger" onClick={() => onDelete(transaction)}>Delete</button>}
                </span>
              )}
              {onEdit && revealDeleteMode && (
                <span className="transaction-actions">
                  <button className="text-button apple-edit-control dashboard-row-control" onClick={() => onEdit(transaction)}>Edit</button>
                </span>
              )}
            </div>
          </article>
        );

        if (!revealDeleteMode) {
          return (
            <div key={transaction.id}>
              {row}
            </div>
          );
        }

        return (
          <div className={`apple-edit-row ${currentActiveDeleteId === transaction.id ? 'reveal-delete' : ''}`} key={transaction.id}>
            <button
              aria-label={`Delete ${getTransactionTitle(transaction)}`}
              className="apple-edit-delete-reveal dashboard-row-delete"
              onClick={() => handleDelete(transaction)}
              type="button"
            >
              Delete
            </button>
            <div className="apple-edit-row-slide">
              <button
                aria-label={currentActiveDeleteId === transaction.id ? `Hide delete for ${getTransactionTitle(transaction)}` : `Show delete for ${getTransactionTitle(transaction)}`}
                className="apple-edit-minus dashboard-row-minus"
                onClick={() => handleRevealDelete(transaction)}
                type="button"
              >
                <span aria-hidden="true">-</span>
              </button>
              {row}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TransactionList({ variant, ...props }) {
  if (variant === 'activity') {
    return <ActivityTransactionList {...props} />;
  }

  return <DashboardTransactionList {...props} />;
}
