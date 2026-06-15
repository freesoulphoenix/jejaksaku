import { useState } from 'react';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import MobileNav from './MobileNav.jsx';

export default function AppLayout({ activePage, children, onAddTransaction, onLogout, onNavigate, onScanReceipt, user }) {
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <div className="app-layout">
      <Header onLogout={onLogout} onNavigate={onNavigate} user={user} />
      <div className="app-body">
        <Sidebar activePage={activePage} onNavigate={onNavigate} />
        <main className="main-content">{children}</main>
      </div>

      <div className="quick-actions">
        {quickOpen && (
          <div className="quick-menu">
            <button onClick={() => { onAddTransaction(); setQuickOpen(false); }}>Add Transaction</button>
          </div>
        )}
        <button
          className={`fab ${quickOpen ? 'is-open' : ''}`}
          aria-label="Open quick actions"
          onClick={() => setQuickOpen((value) => !value)}
        >
          +
        </button>
      </div>

      <MobileNav activePage={activePage} onNavigate={onNavigate} onScanReceipt={onScanReceipt} />
    </div>
  );
}
