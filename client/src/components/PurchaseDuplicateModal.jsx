import { useEffect, useRef, useState } from 'react';
import { mergePurchaseNotes, purchaseConflictFields, purchaseSourceLabel, purchaseValue, resolvePurchaseFields } from '../utils/purchaseMatching.js';

function money(row) {
  const { amount, currency } = purchaseValue(row);
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
}

export default function PurchaseDuplicateModal({ pairs, accounts = [], categories = [], projectTags = [], links = [], onLink, onKeepBoth, onLater, onClose, onUndo }) {
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState(false);
  const [choices, setChoices] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panel = useRef(null);
  const pair = pairs[index];
  useEffect(() => { setPreview(false); setChoices({}); setError(''); }, [pair]);
  useEffect(() => { if (pair?.skipped) setIndex((value) => value + 1); }, [pair]);
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus();
    function keyboard(event) {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const elements = [...panel.current.querySelectorAll('button:not(:disabled), input, select, a[href]')];
      if (!elements.length) { event.preventDefault(); return; }
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [busy, onClose]);

  function label(row, field) {
    if (field === 'category_id') return categories.find((item) => item.id === row[field])?.displayName || categories.find((item) => item.id === row[field])?.name || row.categories?.name || 'Unassigned';
    if (field === 'project_tag_id') return projectTags.find((item) => item.id === row[field])?.name || row.project_tags?.name || 'Unassigned';
    return row[field] || '—';
  }
  async function act(callback, advance = true) {
    setError(''); setBusy(true);
    try {
      const result = await callback();
      if (advance && result !== false) { setIndex((value) => value + 1); setPreview(false); setChoices({}); }
    } catch (err) { setError(err.message || 'Unable to save this decision.'); }
    finally { setBusy(false); }
  }
  let resolved = {}, unresolved = false;
  if (pair) {
    try { resolved = resolvePurchaseFields(pair.first, pair.second, choices); } catch { unresolved = true; }
  }
  return <div className="modal-backdrop purchase-review-backdrop" role="presentation">
    <section className="modal-panel purchase-review-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-review-title" tabIndex={-1} ref={panel}>
      <div className="modal-header"><div><p className="section-kicker">Possible duplicate{pair ? ` · ${index + 1} of ${pairs.length}` : ''}</p><h2 id="purchase-review-title">{preview ? 'Review resulting transaction' : 'Check for entry duplication'}</h2></div><button type="button" className="icon-button" aria-label="Close duplicate review" disabled={busy} onClick={onClose}>×</button></div>
      {error && <p role="alert" className="form-message error">{error}</p>}
      {pair ? <>
        <p className="muted-copy">{pair.confidence}: {pair.reason}</p>
        <div className="purchase-comparison">{[pair.first, pair.second].map((row, position) => <article className="purchase-entry" key={position}>
          <h3>Entry {position + 1} · {purchaseSourceLabel(row)}</h3>
          <dl>
            <dt>Description</dt><dd>{row.description || row.clean_description || '—'}</dd>
            <dt>Purchase date</dt><dd>{row.transaction_date}</dd>
            {row.posting_date && <><dt>Posting date</dt><dd>{row.posting_date}</dd></>}
            <dt>Amount</dt><dd>{money(row)}</dd>
            <dt>Account</dt><dd>{accounts.find((account) => account.id === row.account_id)?.name || row.accounts?.name || 'Unspecified'}</dd>
            {purchaseConflictFields.filter(([field]) => field !== 'description').map(([field, title]) => <div key={field}><dt>{title}</dt><dd className={field === 'notes' ? 'purchase-notes' : undefined}>{label(row, field)}</dd></div>)}
          </dl>
          {row.receipt?.image_url && <a href={row.receipt.image_url} target="_blank" rel="noreferrer">View receipt</a>}
          {row.imported_transaction && <details><summary>View statement record</summary><p>{row.imported_transaction.raw_description || row.imported_transaction.description}</p><p>{row.imported_transaction.statement_import?.file_name}</p></details>}
        </article>)}</div>
        {preview && <section className="purchase-result" aria-label="Resulting transaction">
          <h3>Choose the details to retain</h3>
          {purchaseConflictFields.map(([field, title]) => {
            if (field === 'notes') return <p key={field}><strong>Notes (combined automatically): </strong><span className="purchase-notes">{mergePurchaseNotes(pair.first.notes, pair.second.notes) || '—'}</span></p>;
            const a = pair.first[field] || '', b = pair.second[field] || '';
            if (!(a && b && a !== b)) return <p key={field}><strong>{title}: </strong>{label({ ...pair.first, [field]: a || b }, field)}</p>;
            return <fieldset key={field}><legend>{title} — choose one</legend>{['first', 'second'].map((side, position) => <label key={side}><input type="radio" name={`purchase-${field}`} checked={choices[field] === side} onChange={() => setChoices((current) => ({ ...current, [field]: side }))} />{label(position ? pair.second : pair.first, field)} · from entry {position + 1}</label>)}</fieldset>;
          })}
          {!unresolved && <p><strong>Description: </strong>{resolved.description || '—'}</p>}
          <p>One {pair.first.transaction_type === 'income' ? 'income entry' : 'expense'} of {money(pair.first)} will remain. Both supporting records will be kept.</p>
        </section>}
        <div className="modal-actions">
          <button type="button" className="primary-button" disabled={busy || (preview && unresolved)} onClick={() => preview ? act(() => onLink(pair, choices)) : setPreview(true)}>Link as same purchase</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => act(() => onKeepBoth(pair))}>Keep Both</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => act(() => onLater(pair))}>Review later</button>
        </div>
      </> : <p role="status">{pairs.length ? 'All pairs in this review have been handled or left for later.' : 'No possible duplicates found.'}</p>}
      {links.length > 0 && <details className="purchase-link-history"><summary>Linked purchases · Undo</summary>{links.map((link) => <div className="purchase-history-row" key={link.id}><span>{link.first_before?.description || 'Linked purchase'} · {link.first_before?.transaction_date}</span><button type="button" className="secondary-button small" disabled={busy} onClick={() => act(() => onUndo(link.id), false)}>Undo</button></div>)}</details>}
      {!pair && <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Close</button></div>}
    </section>
  </div>;
}
