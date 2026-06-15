import { useRef, useState } from 'react';

const financialPages = new Set(['accounts', 'transactions', 'due']);

export default function MobileNav({ activePage, onNavigate, onScanReceipt }) {
  const scanInputRef = useRef(null);
  const [openMenu, setOpenMenu] = useState('');

  function navigate(page) {
    setOpenMenu('');
    onNavigate(page);
  }

  function toggleMenu(menu) {
    setOpenMenu((currentMenu) => (currentMenu === menu ? '' : menu));
  }

  function handleScanFile(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = '';

    if (file) {
      setOpenMenu('');
      onScanReceipt(file);
    }
  }

  return (
    <nav className="mobile-nav" aria-label="Primary">
      <div className="mobile-nav-bg" aria-hidden="true" />

      <input
        accept="image/*,.pdf,application/pdf"
        className="visually-hidden-file"
        onChange={handleScanFile}
        ref={scanInputRef}
        type="file"
      />

      {openMenu === 'financial' && (
        <div className="mobile-nav-menu financial-menu">
          <button onClick={() => navigate('accounts')} type="button">Accounts</button>
          <button onClick={() => navigate('transactions')} type="button">Activity</button>
          <button onClick={() => navigate('due')} type="button">Due</button>
        </div>
      )}

      <button
        className={`mobile-nav-button ${financialPages.has(activePage) ? 'active' : ''}`}
        onClick={() => toggleMenu('financial')}
        type="button"
      >
        <i className="mobile-nav-icon fi fi-rr-coins" aria-hidden="true" />
        <small>Finance</small>
      </button>

      <button
        className={`mobile-nav-button ${activePage === 'receipts' ? 'active' : ''}`}
        onClick={() => navigate('receipts')}
        type="button"
      >
        <i className="mobile-nav-icon fi fi-rr-receipt" aria-hidden="true" />
        <small>Receipt</small>
      </button>

      <div className="mobile-nav-spacer" aria-hidden="true" />

      <button
        className={`mobile-nav-button ${activePage === 'statements' ? 'active' : ''}`}
        onClick={() => navigate('statements')}
        type="button"
      >
        <i className="mobile-nav-icon fi fi-rr-file-import" aria-hidden="true" />
        <small>Import</small>
      </button>

      <button
        className={`mobile-nav-button ${activePage === 'reports' ? 'active' : ''}`}
        onClick={() => navigate('reports')}
        type="button"
      >
        <i className="mobile-nav-icon fi fi-rr-chart-histogram" aria-hidden="true" />
        <small>Report</small>
      </button>

      <button
        className={`mobile-nav-button mobile-nav-scan ${activePage === 'receipts' ? 'active' : ''}`}
        onClick={() => scanInputRef.current?.click()}
        type="button"
      >
        <span>Scan</span>
      </button>
    </nav>
  );
}
