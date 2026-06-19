import { formatCurrency } from '../utils/format.js';

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

  return null;
}

export default function AccountCard({
  account,
  deleteRevealActive = false,
  dragOver = false,
  dragging = false,
  isDeleteRevealed,
  isSorting = false,
  onDelete,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onEdit,
  onRevealDelete,
  onToggleDelete,
  revealDeleteMode = false,
  rows = []
}) {
  const reconciledBalance = account.reconciled_balance ?? account.balance;
  const calculatedBalance = account.calculated_balance ?? account.balance;
  const difference = Number(account.balance_difference || 0);
  const isRevealed = isDeleteRevealed ?? deleteRevealActive;
  const useFlatListRow = Boolean(onToggleDelete);

  const differenceClassName =
    difference < 0
      ? 'amount-negative'
      : difference > 0
        ? 'amount-positive'
        : '';

  if (useFlatListRow) {
    const rowClassName = [
      'account-flat-row',
      isRevealed ? 'reveal-delete' : '',
      dragging ? 'is-dragging' : '',
      dragOver ? 'is-drag-over' : ''
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        className={rowClassName}
        onDragOver={(event) => onDragOver?.(event, account)}
        onDrop={(event) => onDrop?.(event, account, rows)}
      >
        <div className="account-row-slide">
          <button
            aria-label={isRevealed ? `Hide delete for ${account.name}` : `Show delete for ${account.name}`}
            className="account-minus-button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleDelete(account.id);
            }}
            type="button"
          >
            <FlatIcon name="minus" />
          </button>

          <div className="account-row-main">
            <strong>{account.name}</strong>

            <small>
              Calculated: {formatCurrency(calculatedBalance)}
              {' - '}
              <span className={differenceClassName}>
                Difference: {formatCurrency(difference)}
              </span>
            </small>
          </div>

          <div className="account-row-tools">
            <strong
              className={[
                'account-row-balance',
                Number(reconciledBalance) < 0 ? 'amount-negative' : ''
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {formatCurrency(reconciledBalance)}
            </strong>

            <button
              aria-label={`Edit ${account.name}`}
              className="account-icon-button"
              onClick={() => onEdit?.(account)}
              type="button"
            >
              <FlatIcon name="edit" />
            </button>

            <button
              aria-label={`Reorder ${account.name}`}
              className="account-icon-button account-grip-button"
              disabled={isSorting}
              draggable
              onDragEnd={onDragEnd}
              onDragStart={(event) => onDragStart?.(event, account)}
              type="button"
            >
              <FlatIcon name="grip" />
            </button>
          </div>
        </div>

        <button
          aria-label={`Delete ${account.name}`}
          className="account-delete-reveal"
          onClick={() => onDelete?.(account)}
          type="button"
        >
          <FlatIcon name="trash" />
        </button>
      </div>
    );
  }

  const content = (
    <>
      <div className="account-icon">{account.name.slice(0, 2).toUpperCase()}</div>
      <div className="account-identity">
        <span>{account.type}</span>
        <h2>{account.name}</h2>
      </div>
      <strong className={Number(reconciledBalance) < 0 ? 'amount-negative' : ''}>
        {formatCurrency(reconciledBalance)}
      </strong>
      <div className="account-balance-detail">
        <span>Calculated: {formatCurrency(calculatedBalance)}</span>
        <span className={differenceClassName}>Difference: {formatCurrency(difference)}</span>
        {account.last_reconciled_at && (
          <span>Last reconciled: {new Date(account.last_reconciled_at).toLocaleDateString('id-ID')}</span>
        )}
      </div>
      {(onDelete || onEdit) && !revealDeleteMode && (
        <div className="account-actions">
          {onEdit && <button className="text-button" onClick={() => onEdit(account)} type="button">Edit</button>}
          {onDelete && <button className="text-button danger" onClick={() => onDelete(account)} type="button">Delete</button>}
        </div>
      )}
    </>
  );

  if (revealDeleteMode) {
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
              onClick={() => onRevealDelete?.(account)}
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
