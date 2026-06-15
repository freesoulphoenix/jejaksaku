import { useEffect, useMemo, useState } from 'react';
import DueItem from '../components/DueItem.jsx';
import { getAccounts } from '../services/accountService.js';
import { getCategories } from '../services/categoryService.js';
import { createDuePaymentTransaction, createUpcomingDue, deleteUpcomingDue, getUpcomingDue, updateUpcomingDue } from '../services/upcomingDueService.js';
import { getCategoryOptions } from '../utils/categoryOptions.js';
import { formatCurrency } from '../utils/format.js';

const today = new Date().toISOString().slice(0, 10);

const emptyForm = {
  title: '',
  provider: '',
  category_id: '',
  payment_account_id: '',
  amount_due: 0,
  due_date: today,
  reminder_days_before: 2,
  reminder_enabled: true,
  browser_notification_enabled: false,
  email_notification_enabled: false,
  recurring_enabled: false,
  recurring_frequency: 'monthly',
  notes: ''
};

function daysUntil(dateString) {
  if (!dateString) {
    return null;
  }

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${dateString}T00:00:00`);
  dueDate.setHours(0, 0, 0, 0);
  return Math.round((dueDate - currentDate) / 86400000);
}

function getReminderItems(items) {
  return items.filter((item) => {
    const days = daysUntil(item.due_date);
    const reminderDays = Number(item.reminder_days_before ?? 2);

    return (
      item.status !== 'paid' &&
      item.reminder_enabled !== false &&
      days !== null &&
      days <= reminderDays
    );
  });
}

function getReminderText(item) {
  const days = daysUntil(item.due_date);

  if (days < 0) {
    return `${item.title} - Overdue by ${Math.abs(days)} days`;
  }

  if (days === 0) {
    return `${item.title} - Due today`;
  }

  if (days === 1) {
    return `${item.title} - Due tomorrow`;
  }

  return `${item.title} - Due in ${days} days`;
}

function formatDueDate(dateString) {
  if (!dateString) {
    return '';
  }

  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function getReviewMessage(daysUntilDue, reminderDays) {
  if (daysUntilDue < 0) {
    return 'This bill is already overdue.';
  }

  if (daysUntilDue === 0) {
    return 'This bill is due today.';
  }

  if (daysUntilDue === 1) {
    return 'This bill is due tomorrow.';
  }

  if (daysUntilDue <= reminderDays) {
    return 'This bill is due soon.';
  }

  return '';
}

function getDueReminderReview(payload) {
  const days = daysUntil(payload.due_date);
  const reminderDays = Number(payload.reminder_days_before ?? 2);

  if (days === null) {
    return null;
  }

  const message = getReviewMessage(days, reminderDays);

  if (!message) {
    return null;
  }

  return {
    days,
    message,
    reminderDays
  };
}

function getReminderBannerTone(items) {
  const soonestDays = items.reduce((soonest, item) => {
    const days = daysUntil(item.due_date);

    if (days === null) {
      return soonest;
    }

    return Math.min(soonest, days);
  }, Infinity);

  if (soonestDays < 0) {
    return 'overdue';
  }

  if (soonestDays === 0) {
    return 'today';
  }

  return 'soon';
}

function sendBrowserNotifications(items) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const storageKey = 'dompetdaily_due_notifications_sent';
  const sent = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
  const todayKey = new Date().toISOString().slice(0, 10);

  items
    .filter((item) => item.browser_notification_enabled)
    .forEach((item) => {
      const itemKey = `${todayKey}:${item.id}`;

      if (sent[itemKey]) {
        return;
      }

      new Notification('Dompet Daily due reminder', {
        body: getReminderText(item)
      });
      sent[itemKey] = true;
    });

  window.localStorage.setItem(storageKey, JSON.stringify(sent));
}

export default function UpcomingDuePage() {
  const [dueItems, setDueItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingDueId, setEditingDueId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const categoryOptions = useMemo(() => getCategoryOptions(categories), [categories]);
  const [pendingReminderReview, setPendingReminderReview] = useState(null);

  const total = dueItems
    .filter((item) => item.status !== 'paid')
    .reduce((sum, item) => sum + Number(item.amount_due || 0), 0);
  const reminderItems = useMemo(() => getReminderItems(dueItems), [dueItems]);
  const reminderBannerTone = useMemo(() => getReminderBannerTone(reminderItems), [reminderItems]);

  async function loadPageData() {
    setError('');
    setLoading(true);

    try {
      const [dueData, accountData, categoryData] = await Promise.all([
        getUpcomingDue(),
        getAccounts(),
        getCategories()
      ]);

      setDueItems(dueData);
      setAccounts(accountData);
      setCategories(categoryData);
    } catch (err) {
      setError(err.message || 'Unable to load upcoming due.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    sendBrowserNotifications(reminderItems);
  }, [reminderItems]);

  function updateField(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function openCreateForm() {
    setForm(emptyForm);
    setEditingDueId(null);
    setIsFormOpen(true);
  }

  function openEditForm(item) {
    setForm({
      title: item.title,
      provider: item.provider || '',
      category_id: item.category_id || '',
      payment_account_id: item.payment_account_id || '',
      amount_due: item.amount_due,
      due_date: item.due_date,
      reminder_days_before: item.reminder_days_before ?? 2,
      reminder_enabled: item.reminder_enabled ?? true,
      browser_notification_enabled: item.browser_notification_enabled || false,
      email_notification_enabled: item.email_notification_enabled || false,
      recurring_enabled: item.recurring_enabled || false,
      recurring_frequency: item.recurring_frequency || 'monthly',
      notes: item.notes || ''
    });
    setEditingDueId(item.id);
    setIsFormOpen(true);
  }

  function closeForm() {
    setForm(emptyForm);
    setEditingDueId(null);
    setIsFormOpen(false);
    setPendingReminderReview(null);
  }

  async function preparePayloadForSave(payload) {
    const preparedPayload = { ...payload };

    if (
      preparedPayload.browser_notification_enabled &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      const permission = await Notification.requestPermission();
      preparedPayload.browser_notification_enabled = permission === 'granted';
    }

    return preparedPayload;
  }

  async function saveDueItem(payload, options = {}) {
    setError('');
    setSaving(true);

    try {
      const preparedPayload = await preparePayloadForSave(payload);
      const savedItem = editingDueId
        ? await updateUpcomingDue(editingDueId, preparedPayload)
        : await createUpcomingDue(preparedPayload);

      if (options.payAfterSave) {
        await createDuePaymentTransaction(savedItem);
      }

      closeForm();
      await loadPageData();
    } catch (err) {
      setError(err.message || 'Unable to save due item.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const payload = { ...form };
    const review = getDueReminderReview(payload);

    if (review) {
      setPendingReminderReview({
        payload,
        review
      });
      return;
    }

    await saveDueItem(payload);
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(`Delete ${item.title}?`);

    if (!confirmed) {
      return;
    }

    setError('');

    try {
      await deleteUpcomingDue(item.id);
      await loadPageData();
    } catch (err) {
      setError(err.message || 'Unable to delete due item.');
    }
  }

  async function handlePayNow(item) {
    const confirmed = window.confirm(`Create an expense transaction and mark ${item.title} as paid?`);

    if (!confirmed) {
      return;
    }

    setError('');

    try {
      await createDuePaymentTransaction(item);
      await loadPageData();
    } catch (err) {
      setError(err.message || 'Unable to pay due item.');
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="section-kicker">Bills and reminders</p>
          <h1>Upcoming Due</h1>
        </div>
        <div className="button-row">
          <span className="summary-pill">{formatCurrency(total)}</span>
          <button className="primary-button" onClick={openCreateForm}>Add Due Item</button>
        </div>
      </section>

      {error && <p className="form-message error">{error}</p>}

      {reminderItems.length > 0 && (
        <section className={`notification-banner ${reminderBannerTone}`}>
          <div>
            <p className="section-kicker">Reminder</p>
            <h2>
              {reminderItems.length === 1
                ? '1 bill needs attention'
                : `${reminderItems.length} bills need attention`}
            </h2>
          </div>
          <div className="notification-list">
            {reminderItems.slice(0, 3).map((item) => (
              <span key={item.id}>{getReminderText(item)}</span>
            ))}
          </div>
        </section>
      )}

      {isFormOpen && (
        <section className="panel">
          <div className="panel-header">
            <h2>{editingDueId ? 'Edit Due Item' : 'Add Due Item'}</h2>
            <button className="text-button" onClick={closeForm}>Cancel</button>
          </div>

          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="field-group">
              Title
              <input
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="Internet bill"
                required
                value={form.title}
              />
            </label>

            <label className="field-group">
              Provider
              <input
                onChange={(event) => updateField('provider', event.target.value)}
                placeholder="Provider"
                value={form.provider}
              />
            </label>

            <label className="field-group">
              Category
              <select onChange={(event) => updateField('category_id', event.target.value)} value={form.category_id}>
                <option value="">Select category</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>{category.displayName}</option>
                ))}
              </select>
            </label>

            <label className="field-group">
              Payment Account
              <select onChange={(event) => updateField('payment_account_id', event.target.value)} value={form.payment_account_id}>
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </label>

            <label className="field-group">
              Amount Due
              <input
                onChange={(event) => updateField('amount_due', event.target.value)}
                required
                type="number"
                value={form.amount_due}
              />
            </label>

            <label className="field-group">
              Due Date
              <input
                onChange={(event) => updateField('due_date', event.target.value)}
                required
                type="date"
                value={form.due_date}
              />
            </label>

            <label className="field-group">
              Remind Days Before
              <input
                min="0"
                onChange={(event) => updateField('reminder_days_before', event.target.value)}
                required
                type="number"
                value={form.reminder_days_before}
              />
            </label>

            <label className="setting-row span-2">
              <span>
                <strong>Notification banner</strong>
                <small>Show this due item inside Dompet Daily before the due date.</small>
              </span>
              <input
                checked={form.reminder_enabled}
                onChange={(event) => updateField('reminder_enabled', event.target.checked)}
                type="checkbox"
              />
            </label>

            <label className="setting-row span-2">
              <span>
                <strong>Browser notification</strong>
                <small>Ask for browser permission before showing desktop notifications.</small>
              </span>
              <input
                checked={form.browser_notification_enabled}
                onChange={(event) => updateField('browser_notification_enabled', event.target.checked)}
                type="checkbox"
              />
            </label>

            <label className="setting-row span-2">
              <span>
                <strong>Email notification</strong>
                <small>Store email consent for the future email reminder service.</small>
              </span>
              <input
                checked={form.email_notification_enabled}
                onChange={(event) => updateField('email_notification_enabled', event.target.checked)}
                type="checkbox"
              />
            </label>

            <label className="setting-row span-2">
              <span>
                <strong>Recurring due generation</strong>
                <small>Create the next due item after this one is marked paid.</small>
              </span>
              <input
                checked={form.recurring_enabled}
                onChange={(event) => updateField('recurring_enabled', event.target.checked)}
                type="checkbox"
              />
            </label>

            {form.recurring_enabled && (
              <label className="field-group">
                Repeat
                <select onChange={(event) => updateField('recurring_frequency', event.target.value)} value={form.recurring_frequency}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </label>
            )}

            <label className="field-group span-2">
              Notes
              <textarea
                onChange={(event) => updateField('notes', event.target.value)}
                placeholder="Add a short note"
                rows="3"
                value={form.notes}
              />
            </label>

            <div className="modal-actions span-2">
              <button className="secondary-button" onClick={closeForm} type="button">Cancel</button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? 'Saving...' : 'Save Due Item'}
              </button>
            </div>
          </form>
        </section>
      )}

      {pendingReminderReview && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel reminder-review-modal" role="dialog" aria-modal="true" aria-labelledby="due-review-title">
            <div className="modal-header">
              <div>
                <p className="section-kicker">Reminder check</p>
                <h2 id="due-review-title">{pendingReminderReview.review.message}</h2>
              </div>
              <button className="icon-button" aria-label="Close reminder check" onClick={() => setPendingReminderReview(null)}>x</button>
            </div>

            <div className="review-detail-list">
              <span>
                <strong>Bill</strong>
                {pendingReminderReview.payload.title}
              </span>
              <span>
                <strong>Due date</strong>
                {formatDueDate(pendingReminderReview.payload.due_date)}
              </span>
              <span>
                <strong>Days remaining</strong>
                {pendingReminderReview.review.days < 0
                  ? `${Math.abs(pendingReminderReview.review.days)} days overdue`
                  : `${pendingReminderReview.review.days} days`}
              </span>
              <span>
                <strong>Reminder setting</strong>
                {pendingReminderReview.review.reminderDays} days before due date
              </span>
            </div>

            <div className="modal-actions">
              <button
                className="secondary-button"
                disabled={saving}
                onClick={() => saveDueItem(pendingReminderReview.payload)}
                type="button"
              >
                {saving ? 'Saving...' : 'Save Anyway'}
              </button>
              <button
                className="text-button"
                disabled={saving}
                onClick={() => setPendingReminderReview(null)}
                type="button"
              >
                Edit Due Date
              </button>
              {pendingReminderReview.review.days <= 0 && (
                <button
                  className="primary-button"
                  disabled={saving}
                  onClick={() => saveDueItem(pendingReminderReview.payload, { payAfterSave: true })}
                  type="button"
                >
                  Pay Now
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {loading && <p className="muted-copy">Loading upcoming due...</p>}

      <section className="due-grid">
        {dueItems.map((item) => (
          <DueItem
            expanded
            item={item}
            key={item.id}
            onDelete={handleDelete}
            onEdit={openEditForm}
            onPayNow={handlePayNow}
          />
        ))}
      </section>
    </div>
  );
}
