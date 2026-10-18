import { useEffect, useState } from 'react';
import PurchaseDuplicateModal from './PurchaseDuplicateModal.jsx';
import { getAccounts } from '../services/accountService.js';
import { getCategories } from '../services/categoryService.js';
import { getProjectTags } from '../services/projectTagService.js';
import { linkSamePurchase } from '../services/purchaseReviewService.js';

// All entry routes use this host through createTransaction, including receipt-first
// and statement-first workflows. No source inserts a second expense before review.
export default function PurchaseReviewHost() {
  const [review, setReview] = useState(null);
  const [separate, setSeparate] = useState([]);
  useEffect(() => {
    let pending = null;
    async function open(event) {
      if (pending) { event.detail.reject(new Error('Finish the open purchase review first.')); return; }
      pending = event.detail;
      try {
        const [accounts, categories, projectTags] = await Promise.all([getAccounts(), getCategories(), getProjectTags()]);
        setSeparate([]);
        setReview({ ...event.detail, accounts, categories, projectTags });
      } catch (error) { pending.reject(error); pending = null; }
    }
    function done() { pending = null; }
    window.addEventListener('review-incoming-purchase', open);
    window.addEventListener('purchase-review-finished', done);
    return () => {
      window.removeEventListener('review-incoming-purchase', open);
      window.removeEventListener('purchase-review-finished', done);
      pending?.reject(new Error('Purchase review closed. The entry was not added.'));
    };
  }, []);
  function finish(result, error) {
    if (error) review.reject(error); else review.resolve(result);
    setReview(null);
    window.dispatchEvent(new Event('purchase-review-finished'));
  }
  if (!review) return null;
  const defer = () => finish(null, new Error('Review later: this entry has not been added. You can submit it again when ready.'));
  return <PurchaseDuplicateModal {...review} onClose={defer} onLater={defer}
    onLink={async (pair, choices) => {
      const reviewId = await linkSamePurchase(pair.first, pair.second, choices, separate);
      finish({ linked: pair.first, reviewId });
    }}
    onKeepBoth={(pair) => {
      const next = [...separate, pair.first];
      setSeparate(next);
      if (next.length === review.pairs.length) finish({ keepSeparate: next });
    }}
  />;
}
