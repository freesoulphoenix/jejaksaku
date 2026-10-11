import { useEffect, useRef, useState } from 'react';
import { getExchangeRate } from '../services/exchangeRateService.js';
import { getLocalIsoDate } from '../utils/dateBounds.js';

export default function CurrencyRateFields({ from, to, rate, mode = 'manual', updatedAt, date, editing, onChange, title = 'Exchange rate' }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const preserveSaved = useRef(editing && mode === 'automatic' && Boolean(rate));
  const generation = useRef(0);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const backdated = date !== getLocalIsoDate();

  useEffect(() => {
    const current = ++generation.current;
    setStatus('');
    setLoading(false);
    if (mode !== 'automatic') { preserveSaved.current = false; return; }
    if (preserveSaved.current) { preserveSaved.current = false; return; }
    if (backdated) { changeRef.current({ mode: 'manual' }); return; }
    if (!from || !to || from === to) return;
    setLoading(true);
    getExchangeRate(from, to).then((data) => {
      if (generation.current !== current) return;
      changeRef.current({ rate: data.rate, updatedAt: data.updatedAt });
      setStatus(data.offline ? 'Offline / unavailable: using cached rate.' : data.cached ? 'Using cached daily rate.' : 'Latest daily rate loaded.');
    }).catch((error) => generation.current === current && setStatus(error.message))
      .finally(() => generation.current === current && setLoading(false));
    return () => { generation.current++; };
  }, [from, to, mode, backdated]);

  async function refresh() {
    const current = generation.current;
    setLoading(true);
    try {
      const data = await getExchangeRate(from, to, true);
      if (generation.current !== current) return;
      changeRef.current({ rate: data.rate, updatedAt: data.updatedAt });
      setStatus(data.offline ? 'Offline / unavailable: using cached rate.' : 'Latest daily rate loaded.');
    } catch (error) { if (generation.current === current) setStatus(error.message); }
    finally { if (generation.current === current) setLoading(false); }
  }

  return <>
    <label className="field-group">{title} mode
      <select disabled={loading} value={mode} onChange={(event) => onChange(event.target.value === 'automatic'
        ? { mode: 'automatic', rate: '', updatedAt: null }
        : { mode: 'manual' })}>
        <option value="manual">Manual / actual bank rate</option>
        <option value="automatic" disabled={backdated && mode !== 'automatic'}>Automatic (daily)</option>
      </select>
    </label>
    <label className="field-group">1 {from} = {to}
      <input type="number" step="any" min="0.000000000001" required value={rate ?? ''} readOnly={mode === 'automatic'} onChange={(event) => onChange({ rate: event.target.value, updatedAt: null })} />
    </label>
    <div className="span-2">
      <p className="muted-copy">{updatedAt ? `Rate last updated: ${new Date(updatedAt).toLocaleString()}` : 'Manual rate — no provider timestamp.'}</p>
      {mode === 'automatic' && <button type="button" className="secondary-button" disabled={loading || backdated} onClick={refresh}>{loading ? 'Refreshing…' : 'Refresh rate'}</button>}
      {status && <p role="status" className="muted-copy">{status}</p>}
      {backdated && <p className="muted-copy">Use the actual historical rate for this transaction date.</p>}
      <small>Rates by <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">ExchangeRate-API</a></small>
    </div>
  </>;
}
