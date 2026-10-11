import { useEffect, useRef } from 'react';
import CurrencyRateFields from './CurrencyRateFields.jsx';
import { formatCurrency } from '../utils/format.js';

export default function TransferCurrencyFields({ form, setForm, accounts, editing }) {
  const source = accounts.find((account) => account.id === form.from_account_id);
  const destination = accounts.find((account) => account.id === form.to_account_id);
  const from = source?.currency_code || 'IDR';
  const to = destination?.currency_code || 'IDR';
  const primary = form.primary_currency;
  const crossCurrency = source && destination && from !== to;
  const previousPair = useRef({ source: source?.id, destination: destination?.id });
  const sent = Number(form.account_amount || 0);
  const received = crossCurrency ? Number(form.destination_amount || 0) : sent;
  const reportRate = from === primary ? 1 : to === primary && received > 0 && sent > 0 ? received / sent : Number(form.exchange_rate || 0);

  useEffect(() => {
    const previous = previousPair.current;
    const sourceChanged = previous.source !== source?.id;
    const destinationChanged = previous.destination !== destination?.id;
    previousPair.current = { source: source?.id, destination: destination?.id };
    if (sourceChanged || destinationChanged) setForm((current) => ({ ...current,
      ...(sourceChanged ? { account_amount: '', amount: 0, exchange_rate: from === primary ? 1 : '', rate_mode: 'manual', rate_updated_at: null } : {}),
      destination_amount: '', transfer_exchange_rate: '', transfer_rate_mode: 'manual', transfer_rate_updated_at: null
    }));
  }, [source?.id, destination?.id]);

  function changeTransferRate(change) {
    setForm((current) => {
      const next = { ...current };
      if (Object.hasOwn(change, 'mode')) next.transfer_rate_mode = change.mode;
      if (Object.hasOwn(change, 'rate')) {
        next.transfer_exchange_rate = change.rate;
        next.destination_amount = Number(current.account_amount || 0) * Number(change.rate);
      }
      if (Object.hasOwn(change, 'updatedAt')) next.transfer_rate_updated_at = change.updatedAt;
      return next;
    });
  }

  return <section className="form-grid span-2" aria-label="Transfer currencies">
    <label className="field-group">Amount sent ({from})
      <input type="number" min="0.00000001" step="any" required value={form.account_amount ?? ''} onChange={(event) => setForm((current) => ({ ...current,
        account_amount: event.target.value,
        ...(crossCurrency && Number(current.transfer_exchange_rate) > 0 ? { destination_amount: Number(event.target.value) * Number(current.transfer_exchange_rate) } : {})
      }))} />
    </label>
    {crossCurrency && <label className="field-group">Amount received ({to})
      <input type="number" min="0.00000001" step="any" required readOnly={form.transfer_rate_mode === 'automatic'} value={form.destination_amount ?? ''} onChange={(event) => setForm((current) => ({ ...current,
        destination_amount: event.target.value,
        transfer_exchange_rate: Number(current.account_amount) > 0 ? Number(event.target.value) / Number(current.account_amount) : '',
        transfer_rate_mode: 'manual', transfer_rate_updated_at: null
      }))} />
    </label>}
    {crossCurrency && <CurrencyRateFields from={from} to={to} date={form.transaction_date} editing={editing}
      rate={form.transfer_exchange_rate || (sent > 0 && received > 0 ? received / sent : '')}
      mode={form.transfer_rate_mode || 'manual'} updatedAt={form.transfer_rate_updated_at}
      onChange={changeTransferRate} title="Transfer rate" />}
    {source && destination && from !== primary && to !== primary && <>
      <p className="muted-copy span-2">Convert the sent amount to {primary} for reports.</p>
      <CurrencyRateFields from={from} to={primary} date={form.transaction_date} editing={editing}
        rate={form.exchange_rate} mode={form.rate_mode || 'manual'} updatedAt={form.rate_updated_at}
        onChange={(change) => setForm((current) => ({ ...current,
          ...(Object.hasOwn(change, 'mode') ? { rate_mode: change.mode } : {}),
          ...(Object.hasOwn(change, 'rate') ? { exchange_rate: change.rate } : {}),
          ...(Object.hasOwn(change, 'updatedAt') ? { rate_updated_at: change.updatedAt } : {})
        }))} />
    </>}
    <p className="muted-copy span-2">{source && destination ? `${source.name}: ${formatCurrency(sent, from)} sent → ${destination.name}: ${formatCurrency(received, to)} received.` : 'Select both account balances.'} Primary value: {reportRate > 0 ? formatCurrency(sent * reportRate, primary) : 'Enter a rate'}. Fees use {from}.</p>
  </section>;
}
