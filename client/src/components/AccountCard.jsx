import { formatCurrency } from '../utils/format.js';

export default function AccountCard({
  account,
  deleteRevealActive = false,
  isDeleteRevealed,
  onDelete,
  onEdit,
  onRevealDelete,
  onToggleDelete,
  revealDeleteMode = false
}) {
  const reconciledBalance = account.reconciled_balance ?? account.balance;
  const calculatedBalance = account.calculated_balance ?? account.balance;
  const difference = Number(account.balance_difference || 0);
  const isRevealed = isDeleteRevealed ?? deleteRevealActive;
  const shouldUseReveal = revealDeleteMode || Boolean(onToggleDelete) || isDeleteRevealed !== undefined;

  const differenceClassName =
    difference < 0
      ? 'amount-negative'
      : difference > 0
        ? 'amount-positive'
        : '';

  function handleToggleDelete() {
    if (onToggleDelete) {
      onToggleDelete(account.id);
      return;
    }

    onRevealDelete?.(account);
  }

  const rowContent = (
    <article className="account-list-row">
      <div className="account-list-main">
        <div className="account-list-icon">
          {account.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="account-list-details">
          <h3>{account.name}</h3>

          <p>
            Calculated: {formatCurrency(calculatedBalance)}
            {' - '}
            <span className={differenceClassName}>
              Difference: {formatCurrency(difference)}
            </span>
          </p>

          {account.last_reconciled_at && (
            <small>
              Last reconciled:{' '}
              {new Date(account.last_reconciled_at).toLocaleDateString('id-ID')}
            </small>
          )}
        </div>
      </div>

      <div className="account-list-right">
        <strong className={Number(reconciledBalance) < 0 ? 'amount-negative' : ''}>
          {formatCurrency(reconciledBalance)}
        </strong>

        <div className="account-list-actions">
          {onEdit && (
            <button
              className="text-button apple-edit-control dashboard-row-control"
              onClick={() => onEdit(account)}
              type="button"
            >
              Edit
            </button>
          )}

          {onDelete && !shouldUseReveal && (
            <button
              className="text-button danger"
              onClick={() => onDelete(account)}
              type="button"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );

  if (!shouldUseReveal) {
    return rowContent;
  }

  return (
    <div className={`apple-edit-row account-edit-row ${isRevealed ? 'reveal-delete' : ''}`}>
      {onDelete && (
        <button
          aria-label={`Delete ${account.name}`}
          className="apple-edit-delete-reveal dashboard-row-delete"
          onClick={() => onDelete(account)}
          type="button"
        >
          Delete
        </button>
      )}
      <div className="apple-edit-row-slide">
        {onDelete && (
          <button
            aria-label={isRevealed ? `Hide delete for ${account.name}` : `Show delete for ${account.name}`}
            className="apple-edit-minus dashboard-row-minus"
            onClick={handleToggleDelete}
            type="button"
          >
            <span aria-hidden="true">-</span>
          </button>
        )}
        <div className="apple-edit-card-content">
          {rowContent}
        </div>
      </div>
    </div>
  );
}
