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
  const difference = Number(account.balance_difference || 0);
  const isRevealed = isDeleteRevealed ?? deleteRevealActive;
  const shouldUseReveal = revealDeleteMode || Boolean(onToggleDelete) || isDeleteRevealed !== undefined;

  function handleToggleDelete() {
    if (onToggleDelete) {
      onToggleDelete(account.id);
      return;
    }

    onRevealDelete?.(account);
  }

  const content = (
    <>
      <div className="account-icon">{account.name.slice(0, 2).toUpperCase()}</div>
      <div className="account-identity">
        <span>{account.type}</span>
        <h2>{account.name}</h2>
      </div>
      <strong className={account.reconciled_balance < 0 ? 'amount-negative' : ''}>
        {formatCurrency(account.reconciled_balance ?? account.balance)}
      </strong>
      <div className="account-balance-detail">
        <span>Calculated: {formatCurrency(account.calculated_balance ?? account.balance)}</span>
        <span className={difference < 0 ? 'amount-negative' : difference > 0 ? 'amount-positive' : ''}>
          Difference: {formatCurrency(difference)}
        </span>
        {account.last_reconciled_at && (
          <span>Last reconciled: {new Date(account.last_reconciled_at).toLocaleDateString('id-ID')}</span>
        )}
      </div>
      {(onDelete || onEdit) && !shouldUseReveal && (
        <div className="account-actions">
          {onEdit && <button className="text-button" onClick={() => onEdit(account)} type="button">Edit</button>}
          {onDelete && <button className="text-button danger" onClick={() => onDelete(account)} type="button">Delete</button>}
        </div>
      )}
      {onEdit && shouldUseReveal && (
        <div className="account-actions">
          <button className="text-button apple-edit-control dashboard-row-control" onClick={() => onEdit(account)} type="button">
            Edit
          </button>
        </div>
      )}
    </>
  );

  if (shouldUseReveal) {
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
          <article className="account-card apple-edit-card-content">
            {content}
          </article>
        </div>
      </div>
    );
  }

  return (
    <article className="account-card">
      {content}
    </article>
  );
}
