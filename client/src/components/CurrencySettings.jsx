import { useState } from 'react';
import { getCurrencyPreferences, saveCurrencyPreferences, supportedCurrencies } from '../utils/currency.js';
import { formatCurrency } from '../utils/format.js';

export default function CurrencySettings() {
  const [preferences, setPreferences] = useState(getCurrencyPreferences);
  const [error, setError] = useState('');
  function update(next) {
    try { saveCurrencyPreferences(next); setPreferences(next); setError(''); }
    catch { setError('Unable to save currency preferences.'); }
  }
  return <section className="form-grid" aria-label="Currency preferences">
    {['primary', 'secondary'].map((kind) => {
      const code = preferences[kind];
      const format = { position: 'front', decimals: 2, ...preferences.formats[code] };
      const updateFormat = (field, value) => update({ ...preferences, formats: { ...preferences.formats, [code]: { ...format, [field]: value } } });
      return <div key={kind}>
        <label className="field-group">{kind === 'primary' ? 'Primary Currency' : 'Secondary Currency'}
          <select value={code} onChange={(event) => update({ ...preferences, [kind]: event.target.value })}>
            {supportedCurrencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} — {currency.name}</option>)}
          </select>
        </label>
        <label className="field-group">Unit Position
          <select value={format.position} onChange={(event) => updateFormat('position', event.target.value)}><option value="front">Front</option><option value="end">End</option></select>
        </label>
        <label className="field-group">Decimal places
          <select value={format.decimals} onChange={(event) => updateFormat('decimals', Number(event.target.value))}>{[0, 1, 2, 3, 4].map((value) => <option key={value}>{value}</option>)}</select>
        </label>
        <p className="muted-copy">Example: {formatCurrency(1234.56, code)}</p>
      </div>;
    })}
    <p className="muted-copy span-2">Preferences are saved in this browser. Account balances keep their own currency; transaction conversions keep their saved rate.</p>
    {error && <p className="form-message error span-2">{error}</p>}
  </section>;
}
