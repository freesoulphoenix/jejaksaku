import { useEffect, useRef, useState } from 'react';
import { getCurrencyPreferences } from '../utils/currency.js';
import { getExchangeRate } from '../services/exchangeRateService.js';
import { getLocalIsoDate } from '../utils/dateBounds.js';

export default function TransactionCurrencyFields({ form, setForm, accounts, editing }) {
  const primary = form.primary_currency || getCurrencyPreferences().primary;
  const source = accounts.find((account) => account.id === (form.transaction_type === 'transfer' ? form.from_account_id : form.account_id));
  const destination = accounts.find((account) => account.id === form.to_account_id);
  const accountCurrency = source?.currency_code || 'IDR';
  const currency = form.original_currency || accountCurrency;
  const mode = form.rate_mode || 'manual';
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const previousSource = useRef(editing ? source?.id : null);
  const preserveSavedRate = useRef(editing && mode === 'automatic' && Boolean(form.exchange_rate));
  const backdated = form.transaction_date !== getLocalIsoDate();
  const needsRate = currency !== primary;
  const crossTransfer = form.transaction_type === 'transfer' && destination && destination.currency_code !== accountCurrency;
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  useEffect(() => {
    if (source && previousSource.current !== source.id) {
      previousSource.current = source.id;
      setForm((current) => ({ ...current, original_currency: accountCurrency, original_amount: '', exchange_rate: accountCurrency === primary ? 1 : '', rate_updated_at: null, rate_mode: 'manual', account_amount: '', destination_amount: '' }));
    }
  }, [source?.id]);
  useEffect(() => {
    if (!needsRate) setForm((current) => ({ ...current, exchange_rate: 1, rate_updated_at: null }));
  }, [currency, primary]);
  useEffect(() => {
    if (backdated && mode === 'automatic') update('rate_mode', 'manual');
  }, [backdated]);
  useEffect(() => {
    if (mode !== 'automatic') { preserveSavedRate.current = false; return; }
    if (!needsRate || backdated) return;
    if (preserveSavedRate.current) { preserveSavedRate.current = false; return; }
    let active = true;
    setLoading(true);
    getExchangeRate(currency, primary).then((data) => {
      if (!active) return;
      setForm((current) => ({ ...current, exchange_rate: data.rate, rate_updated_at: data.updatedAt }));
      setStatus(data.offline ? 'Offline / unavailable: using cached rate.' : data.cached ? 'Using cached rate.' : 'Latest daily rate loaded.');
    }).catch((error) => active && setStatus(error.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [mode, currency, primary, backdated]);
  async function refresh() {
    setLoading(true);
    try {
      const data = await getExchangeRate(currency, primary, true);
      setForm((current) => ({ ...current, exchange_rate: data.rate, rate_updated_at: data.updatedAt }));
      setStatus(data.offline ? 'Offline / unavailable: using cached rate.' : 'Latest daily rate loaded.');
    } catch (error) { setStatus(error.message); }
    finally { setLoading(false); }
  }
  return <section className="form-grid span-2" aria-label="Transaction currency">
    <label className="field-group">Input currency
      <select disabled={loading} value={currency} onChange={(event) => setForm((current) => ({ ...current, original_currency: event.target.value, exchange_rate: event.target.value === primary ? 1 : '', rate_updated_at: null, rate_mode: 'manual' }))}>
        {[...new Set([primary, getCurrencyPreferences().secondary, accountCurrency, currency])].map((code) => <option key={code}>{code}</option>)}
      </select>
    </label>
    <label className="field-group">{currency === primary ? 'Original amount' : 'Secondary Currency amount'} ({currency})
      <input type="number" min="0.00000001" step="any" required={currency !== primary || accountCurrency !== primary} value={form.original_amount ?? ''} onChange={(event) => update('original_amount', event.target.value)} placeholder="Optional when entering primary amount" />
    </label>
    {needsRate && <>
      <label className="field-group">Exchange rate mode
        <select disabled={loading} value={mode} onChange={(event) => update('rate_mode', event.target.value)}><option value="manual">Manual / actual bank rate</option><option value="automatic" disabled={backdated}>Automatic (daily)</option></select>
      </label>
      <label className="field-group">1 {currency} = {primary}
        <input type="number" min="0.000000000001" step="any" required value={form.exchange_rate ?? ''} readOnly={mode === 'automatic'} onChange={(event) => update('exchange_rate', event.target.value)} />
      </label>
      <div className="span-2">
        <p className="muted-copy">{form.rate_updated_at ? `Rate last updated: ${new Date(form.rate_updated_at).toLocaleString()}` : 'Manual rate — no provider timestamp.'}</p>
        {mode === 'automatic' && <button type="button" className="secondary-button" disabled={loading} onClick={refresh}>{loading ? 'Refreshing…' : 'Refresh rate'}</button>}
        {status && <p role="status" className="muted-copy">{status}</p>}
        {backdated && <p className="muted-copy">Enter the actual historical rate for this transaction date.</p>}
        <small>Rates by <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">ExchangeRate-API</a></small>
      </div>
    </>}
    {accountCurrency !== currency && accountCurrency !== primary && <label className="field-group">Actual account amount ({accountCurrency})
      <input type="number" min="0.00000001" step="any" required value={form.account_amount ?? ''} onChange={(event) => update('account_amount', event.target.value)} />
    </label>}
    {crossTransfer && <label className="field-group">Amount received ({destination.currency_code})
      <input type="number" min="0.00000001" step="any" required value={form.destination_amount ?? ''} onChange={(event) => update('destination_amount', event.target.value)} />
    </label>}
    <p className="muted-copy span-2">Primary value: {primary} {form.original_amount ? (Number(form.original_amount) * Number(form.exchange_rate || (currency === primary ? 1 : 0))).toLocaleString() : Number(form.amount || 0).toLocaleString()}. Account: {accountCurrency}. Transfer fees use the source account currency.</p>
  </section>;
}
