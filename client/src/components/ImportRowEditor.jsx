import BoundedDatePicker from './BoundedDatePicker.jsx';
import { earliestHistoricalDate, getLocalIsoDate } from '../utils/dateBounds.js';
import { getCurrencyPreferences, supportedCurrencies } from '../utils/currency.js';

export default function ImportRowEditor({ row, accounts, categories, projectTags, onChange, onSave, onCancel }) {
  const primary = getCurrencyPreferences().primary;
  const currency = row.input_currency || primary;
  const transfer = row.transaction_type === 'transfer';
  const select = (field, title, options, empty) => <label className="field-group">{title}<select value={row[field] || ''} onChange={(event) => onChange(field, event.target.value)}>{empty && <option value="">{empty}</option>}{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>;
  const accountOptions = accounts.map((account) => [account.id, account.name]);
  return <div className="statement-row-editor">
    <label className="field-group">Description<input value={row.clean_description || ''} onChange={(event) => onChange('clean_description', event.target.value)} /></label>
    <BoundedDatePicker label="Date" maxDate={getLocalIsoDate()} minDate={earliestHistoricalDate} required value={row.transaction_date || ''} onChange={(value) => onChange('transaction_date', value)} />
    {select(transfer ? 'from_account_id' : 'account_id', transfer ? 'From Account' : 'Source Account', accountOptions, 'Select account')}
    {select('transaction_type', 'Type', [['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer']])}
    <label className="field-group">Input Currency<select value={currency} onChange={(event) => { onChange('input_currency', event.target.value); onChange('exchange_rate', ''); }}>{supportedCurrencies.map(({ code }) => <option key={code}>{code}</option>)}</select></label>
    <label className="field-group">Amount<input type="number" min="0.00000001" step="any" value={Math.abs(Number(row.amount || 0))} onChange={(event) => onChange('amount', event.target.value)} /></label>
    {currency !== primary && <label className="field-group span-2">1 {currency} = {primary}<input type="number" min="0.000000000001" step="any" value={row.exchange_rate ?? ''} onChange={(event) => onChange('exchange_rate', event.target.value)} placeholder="Actual historical exchange rate" /></label>}
    {select('financial_activity', 'Activity', [['standard', 'Standard Purchase'], ['payment', 'Card payment'], ['refund', 'Refund'], ['fee', 'Fee / interest'], ['cash_advance', 'Cash advance'], ['installment', 'Installment']])}
    {select('project_tag_id', 'Project Tag', projectTags.map((tag) => [tag.id, tag.name]), 'Select project tag')}
    {!transfer ? select('category_id', 'Category', categories.map((category) => [category.id, category.displayName]), 'Select category') : select('to_account_id', 'To Account', accountOptions, 'Select destination account')}
    <label className="field-group">Notes<input value={row.notes || ''} onChange={(event) => onChange('notes', event.target.value)} /></label>
    {transfer && <label className="field-group span-2">Transfer Fee<input type="number" min="0" step="any" value={row.transfer_fee || 0} onChange={(event) => onChange('transfer_fee', event.target.value)} /></label>}
    <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
    <button type="button" className="primary-button" onClick={onSave}>Save Row</button>
  </div>;
}
