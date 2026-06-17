import { formatCurrency } from '../utils/format.js';

export default function AccountCard({ account, onDelete, onEdit }) {
  const difference = Number(account.balance_difference || 0);

  return (
    <article className="account-card">
      <div className="account-icon">{account.name.slice(0, 2).toUpperCase()}</div>
      <div>
        <span>{account.type}</span>
        <h2>{account.name}</h2>
      </div>
      <strong className={account.reconciled_balance < 0 ? 'amount-negative' : ''}>{formatCurrency(account.reconciled_balance ?? account.balance)}</strong>
      <div className="account-balance-detail">
        <span>Calculated: {formatCurrency(account.calculated_balance ?? account.balance)}</span>
        <span className={difference < 0 ? 'amount-negative' : difference > 0 ? 'amount-positive' : ''}>
          Difference: {formatCurrency(difference)}
        </span>
        {account.last_reconciled_at && (
          <span>Last reconciled: {new Date(account.last_reconciled_at).toLocaleDateString('id-ID')}</span>
        )}
      </div>
      {(onDelete || onEdit) && (
        <div className="account-actions">
          {onEdit && <button className="text-button" onClick={() => onEdit(account)}>Edit</button>}
          {onDelete && <button className="text-button danger" onClick={() => onDelete(account)}>Delete</button>}
        </div>
      )}
    </article>
  );
}
