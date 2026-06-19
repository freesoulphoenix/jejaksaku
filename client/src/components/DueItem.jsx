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

function formatDueDay(item) {
  const rawDate = item.due_date || item.dueDate;

  if (!rawDate) {
    return '';
  }

  if (rawDate.includes(' ')) {
    return rawDate.split(' ')[1] || rawDate;
  }

  return new Date(`${rawDate}T00:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short'
  });
}

function daysUntil(dateString) {
  if (!dateString) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${dateString}T00:00:00`);
  dueDate.setHours(0, 0, 0, 0);

  return Math.round((dueDate - today) / 86400000);
}

function formatDueDate(dateString) {
  if (!dateString) {
    return '';
  }

  return new Date(`${dateString}T00:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getDueTimingText(item) {
  if (item.status === 'paid') {
    return 'paid';
  }

  const days = item.daysLeft ?? daysUntil(item.due_date);

  if (days === null) {
    return item.status || 'upcoming';
  }

  if (days < 0) {
    return `${Math.abs(days)} days overdue`;
  }

  if (days === 0) {
    return 'due today';
  }

  return `in ${days} days`;
}

export default function DueItem({
  deleteRevealActive = false,
  expanded = false,
  isDeleteRevealed,
  item,
  onDelete,
  onEdit,
  onPayNow,
  onRevealDelete,
  onToggleDelete,
  revealDeleteMode = false
}) {
  const title = item.title || item.name || 'Due item';
  const amount = Number(item.amount_due ?? item.amount ?? 0);
  const provider = item.provider || item.categories?.name || 'Due item';
  const accountName = item.accounts?.name || '';
  const reminderText =
    item.reminder_enabled === false
      ? 'reminder off'
      : `reminds ${item.reminder_days_before ?? 2} days before`;
  const isRevealed = isDeleteRevealed ?? deleteRevealActive;

  if (onToggleDelete) {
    const subtitle = [
      formatDueDate(item.due_date),
      provider,
      getDueTimingText(item),
      accountName,
      reminderText,
      item.recurring_enabled ? `repeats ${item.recurring_frequency || 'monthly'}` : ''
    ]
      .filter(Boolean)
      .join(' - ');

    const rowClassName = [
      'due-flat-row',
      isRevealed ? 'reveal-delete' : ''
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={rowClassName}>
        <div className="due-row-slide">
          <button
            aria-label={isRevealed ? `Hide delete for ${title}` : `Show delete for ${title}`}
            className="due-minus-button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleDelete(item.id);
            }}
            type="button"
          >
            <FlatIcon name="minus" />
          </button>

          <div className="due-row-main">
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </div>

          <div className="due-row-tools">
            <div className="due-row-payment">
              <strong>{formatCurrency(amount)}</strong>

              {onPayNow && item.status !== 'paid' && (
                <button
                  className="due-pay-now-button"
                  onClick={() => onPayNow(item)}
                  type="button"
                >
                  Pay Now
                </button>
              )}
            </div>

            <button
              aria-label={`Edit ${title}`}
              className="due-icon-button"
              onClick={() => onEdit?.(item)}
              type="button"
            >
              <FlatIcon name="edit" />
            </button>

            <span
              aria-hidden="true"
              className="due-grip"
              title="Due items are ordered by due date"
            >
              <FlatIcon name="grip" />
            </span>
          </div>
        </div>

        <button
          aria-label={`Delete ${title}`}
          className="due-delete-reveal"
          onClick={() => onDelete?.(item)}
          type="button"
        >
          <FlatIcon name="trash" />
        </button>
      </div>
    );
  }

  const row = (
    <article className={`due-item ${expanded ? 'expanded' : ''}`}>
      <span className="due-date">{formatDueDay(item)}</span>
      <div className="due-main">
        <strong>{title}</strong>
        <span>{provider} - {getDueTimingText(item)}</span>
        {accountName && <span>{accountName}</span>}
        {expanded && (
          <span>
            {reminderText}
            {item.recurring_enabled && ` - repeats ${item.recurring_frequency || 'monthly'}`}
          </span>
        )}
      </div>
      <div className="due-meta">
        <strong>{formatCurrency(amount)}</strong>
        {expanded && (
          <span className="due-actions">
            {onPayNow && item.status !== 'paid' && (
              <button className="secondary-button small apple-edit-control dashboard-row-control" onClick={() => onPayNow(item)}>Pay Now</button>
            )}
            {onEdit && <button className="text-button apple-edit-control dashboard-row-control" onClick={() => onEdit(item)}>Edit</button>}
            {onDelete && !revealDeleteMode && <button className="text-button danger" onClick={() => onDelete(item)}>Delete</button>}
          </span>
        )}
      </div>
    </article>
  );

  if (!revealDeleteMode) {
    return row;
  }

  return (
    <div className={`apple-edit-row ${isRevealed ? 'reveal-delete' : ''}`}>
      <button
        aria-label={`Delete ${title}`}
        className="apple-edit-delete-reveal dashboard-row-delete"
        onClick={() => onDelete?.(item)}
        type="button"
      >
        Delete
      </button>
      <div className="apple-edit-row-slide">
        <button
          aria-label={isRevealed ? `Hide delete for ${title}` : `Show delete for ${title}`}
          className="apple-edit-minus dashboard-row-minus"
          onClick={() => onRevealDelete?.(item)}
          type="button"
        >
          <span aria-hidden="true">-</span>
        </button>
        {row}
      </div>
    </div>
  );
}
