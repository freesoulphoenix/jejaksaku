import { formatCurrency } from '../utils/format.js';

export default function AccountCard({ account, onDelete, onEdit }) {
  return (
    <article className="account-card">
      <div className="account-icon">{account.name.slice(0, 2).toUpperCase()}</div>
      <div>
        <span>{account.type}</span>
        <h2>{account.name}</h2>
      </div>
      <strong className={account.balance < 0 ? 'amount-negative' : ''}>{formatCurrency(account.balance)}</strong>
      {(onDelete || onEdit) && (
        <div className="account-actions">
          {onEdit && <button className="text-button" onClick={() => onEdit(account)}>Edit</button>}
          {onDelete && <button className="text-button danger" onClick={() => onDelete(account)}>Delete</button>}
        </div>
      )}
    </article>
  );
}
