import { formatCurrency } from '../utils/format.js';

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

export default function DueItem({ expanded = false, item, onDelete, onEdit, onPayNow }) {
  const title = item.title || item.name;
  const amount = item.amount_due ?? item.amount;
  const reminderText = item.reminder_enabled === false
    ? 'reminder off'
    : `reminds ${item.reminder_days_before ?? 2} days before`;

  return (
    <article className={`due-item ${expanded ? 'expanded' : ''}`}>
      <span className="due-date">{formatDueDay(item)}</span>
      <div className="due-main">
        <strong>{title}</strong>
        <span>{item.provider || item.categories?.name || 'Due item'} - {getDueTimingText(item)}</span>
        {item.accounts?.name && <span>{item.accounts.name}</span>}
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
              <button className="secondary-button small" onClick={() => onPayNow(item)}>Pay Now</button>
            )}
            {onEdit && <button className="text-button" onClick={() => onEdit(item)}>Edit</button>}
            {onDelete && <button className="text-button danger" onClick={() => onDelete(item)}>Delete</button>}
          </span>
        )}
      </div>
    </article>
  );
}
