import { supabase } from './supabaseClient.js';
import { getCurrentUserProfileId } from './userProfileService.js';
import { findPurchasePairs, purchaseMatch, resolvePurchaseFields } from '../utils/purchaseMatching.js';

export async function getPurchaseReviews() {
  const profileId = await getCurrentUserProfileId();
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('purchase_reviews').select('*').eq('user_profile_id', profileId).is('undone_at', null).order('created_at', { ascending: false }).order('id').range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

export async function checkExistingDuplicates() {
  const { getTransactions } = await import('./transactionService.js');
  const [rows, reviews] = await Promise.all([getTransactions(), getPurchaseReviews()]);
  return { pairs: findPurchasePairs(rows, reviews.filter((review) => review.decision === 'keep_both')), links: reviews.filter((review) => review.decision === 'linked') };
}

export async function keepPurchasesSeparate(first, second) {
  const profileId = await getCurrentUserProfileId();
  const { error } = await supabase.from('purchase_reviews').insert({ user_profile_id: profileId, first_transaction_id: first.id, second_transaction_id: second.id, decision: 'keep_both' });
  if (error) throw error;
}

export async function linkSamePurchase(first, second, choices, separate = []) {
  const selected = resolvePurchaseFields(first, second, choices);
  const { data, error } = await supabase.rpc('link_same_purchase', { keep_id: first.id, other_id: second.id || null, incoming: second.id ? null : second, selected_fields: selected, separate_ids: separate.map((row) => row.id) });
  if (error) throw error;
  return data;
}

export async function undoPurchaseLink(id) {
  const { error } = await supabase.rpc('undo_purchase_link', { review_id: id });
  if (error) throw error;
}

export async function reviewIncomingPurchase(incoming) {
  if (incoming.transaction_type === 'transfer') return { keepSeparate: [] };
  const { getTransactions } = await import('./transactionService.js');
  const rows = await getTransactions();
  // Source IDs are definitive; never create the same imported/receipt record twice.
  const exact = rows.find((row) => (incoming.receipt_id && row.receipt_id === incoming.receipt_id) || (incoming.imported_transaction_id && row.imported_transaction_id === incoming.imported_transaction_id));
  if (exact) return { linked: exact };
  let source = incoming;
  if (incoming.receipt_id) {
    const { data, error } = await supabase.from('receipts').select('id, merchant_name, image_url').eq('id', incoming.receipt_id).eq('user_profile_id', incoming.user_profile_id).single();
    if (error) throw error;
    source = { ...source, receipt: data };
  }
  if (incoming.imported_transaction_id) {
    const { data, error } = await supabase.from('imported_transactions').select('*, statement_import:statement_import_id(file_name)').eq('id', incoming.imported_transaction_id).eq('user_profile_id', incoming.user_profile_id).single();
    if (error) throw error;
    source = { ...source, imported_transaction: data };
  }
  const pairs = rows.flatMap((row) => {
    const match = purchaseMatch(row, source);
    return match ? [{ first: row, second: source, ...match }] : [];
  });
  if (!pairs.length) return { keepSeparate: [] };
  if (typeof window === 'undefined') throw new Error('Duplicate review requires the application to be open.');
  return new Promise((resolve, reject) => window.dispatchEvent(new CustomEvent('review-incoming-purchase', { detail: { pairs, resolve, reject } })));
}
