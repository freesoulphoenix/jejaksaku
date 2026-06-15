import { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { LanguageProvider } from './contexts/LanguageContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AccountsPage from './pages/AccountsPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import UpcomingDuePage from './pages/UpcomingDuePage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import ReceiptsPage from './pages/ReceiptsPage.jsx';
import StatementImportPage from './pages/StatementImportPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import AddTransactionModal from './components/AddTransactionModal.jsx';
import BrandMark from './components/BrandMark.jsx';

const accounts = [
  { id: 'cash', name: 'Cash', type: 'Cash', balance: 850000 },
  { id: 'bca', name: 'BCA', type: 'Bank Account', balance: 12500000 },
  { id: 'jago', name: 'Jago', type: 'Bank Account', balance: 1800000 },
  { id: 'gopay', name: 'GoPay', type: 'E-Wallet', balance: 320000 },
  { id: 'shopee', name: 'Shopee PayLater', type: 'PayLater', balance: -1250000 },
  { id: 'indodana', name: 'Indodana Pinjam', type: 'Loan', balance: -5400000 }
];

const transactions = [
  { id: 'tx1', type: 'expense', title: 'Kopi Kenangan', category: 'Food & Drink', account: 'GoPay', amount: -45000, date: 'Today' },
  { id: 'tx2', type: 'expense', title: 'GoRide ke kantor', category: 'Transport', account: 'GoPay', amount: -28000, date: 'Today' },
  { id: 'tx3', type: 'expense', title: 'Belanja mingguan', category: 'Groceries', account: 'BCA', amount: -312000, date: 'Yesterday' },
  { id: 'tx4', type: 'income', title: 'Salary', category: 'Income', account: 'BCA', amount: 12000000, date: '2 days ago' },
  { id: 'tx5', type: 'transfer', title: 'Top up GoPay', category: 'Transfer', account: 'BCA to GoPay', amount: 500000, date: '3 days ago' }
];

const reports = [
  { label: 'Food & Drink', value: 420000, color: '#2196f3' },
  { label: 'Transport', value: 185000, color: '#26c6da' },
  { label: 'Groceries', value: 612000, color: '#64b5f6' },
  { label: 'Bills', value: 1221000, color: '#7986cb' }
];

const pageMap = {
  dashboard: DashboardPage,
  accounts: AccountsPage,
  transactions: TransactionsPage,
  due: UpcomingDuePage,
  reports: ReportsPage,
  receipts: ReceiptsPage,
  statements: StatementImportPage,
  settings: SettingsPage
};

function getSafetyNoticeKey(user) {
  return `dompetdaily_safety_notice_${user?.id || 'guest'}`;
}

function SafetyNoticePage({ onAcknowledge, user }) {
  return (
    <div className="auth-shell safety-notice-shell">
      <div className="auth-card safety-notice-card">
        <BrandMark />
        <div className="auth-heading">
          <p className="section-kicker">Before you continue</p>
          <h1>Protect your private information</h1>
          <p>
            Dompet Daily is for personal finance records, spending reports, receipt history, and analysis.
            It is not a banking app, payment app, or transactional service.
          </p>
        </div>

        <div className="safety-notice-list">
          <p>Do not enter bank account numbers, card numbers, CVV, PIN, passwords, OTP codes, or other confidential credentials.</p>
          <p>Use general account names like BCA, GoPay, Credit Card, or Cash. Put provider details only when they are safe for record keeping.</p>
          <p>Receipts and statements may contain sensitive data. Upload only files you are comfortable storing for tracking and review.</p>
        </div>

        <button className="primary-button auth-submit" onClick={onAcknowledge} type="button">
          I understand
        </button>
        <p className="muted-copy safety-notice-user">Signed in as {user?.email}</p>
      </div>
    </div>
  );
}

function OfflineNotice() {
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));

  useEffect(() => {
    function updateNetworkStatus() {
      setIsOnline(navigator.onLine);
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div className="offline-notice" role="status">
      You are offline. Dompet Daily will keep the app open, but fresh account data and uploads need a connection.
    </div>
  );
}

function ProtectedApp() {
  const { loading, user, logout } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [authPage, setAuthPage] = useState('login');
  const [pendingReceiptFile, setPendingReceiptFile] = useState(null);
  const [hasAcknowledgedSafety, setHasAcknowledgedSafety] = useState(false);
  const ActivePage = pageMap[activePage] || DashboardPage;

  const summary = useMemo(() => {
    const assets = accounts.filter((account) => account.balance > 0).reduce((sum, account) => sum + account.balance, 0);
    const debt = Math.abs(accounts.filter((account) => account.balance < 0).reduce((sum, account) => sum + account.balance, 0));
    const monthSpend = Math.abs(transactions.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0));
    const monthIncome = transactions.filter((transaction) => transaction.type === 'income').reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      assets,
      debt,
      netWorth: assets - debt,
      monthSpend,
      monthIncome,
      dueThisMonth: 0
    };
  }, []);

  function handleMobileReceiptScan(file) {
    setPendingReceiptFile({
      file,
      token: Date.now()
    });
    setActivePage('receipts');
  }

  function handleReceiptFileConsumed() {
    setPendingReceiptFile(null);
  }

  useEffect(() => {
    if (!user) {
      setHasAcknowledgedSafety(false);
      return;
    }

    setHasAcknowledgedSafety(localStorage.getItem(getSafetyNoticeKey(user)) === 'true');
  }, [user]);

  function acknowledgeSafetyNotice() {
    localStorage.setItem(getSafetyNoticeKey(user), 'true');
    setHasAcknowledgedSafety(true);
  }

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="auth-card compact">
          <BrandMark />
          <p>Checking your Dompet Daily session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (authPage === 'register') {
      return (
      <RegisterPage onShowLogin={() => setAuthPage('login')} />
      );
    }

    if (authPage === 'forgot') {
      return (
        <ForgotPasswordPage onShowLogin={() => setAuthPage('login')} />
      );
    }

    return (
      <LoginPage
        onShowForgotPassword={() => setAuthPage('forgot')}
        onShowRegister={() => setAuthPage('register')}
      />
    );
  }

  if (!hasAcknowledgedSafety) {
    return (
      <SafetyNoticePage
        onAcknowledge={acknowledgeSafetyNotice}
        user={user}
      />
    );
  }

  return (
    <AppLayout
      activePage={activePage}
      onNavigate={setActivePage}
      onAddTransaction={() => setIsAddOpen(true)}
      onLogout={logout}
      user={user}
      onScanReceipt={handleMobileReceiptScan}
    >
      <ActivePage
        accounts={accounts}
        reports={reports}
        summary={summary}
        transactions={transactions}
        onNavigate={setActivePage}
        onAddTransaction={() => setIsAddOpen(true)}
        onLogout={logout}
        pendingReceiptFile={activePage === 'receipts' ? pendingReceiptFile : null}
        onReceiptFileConsumed={handleReceiptFileConsumed}
        user={user}
      />
      {isAddOpen && (
        <AddTransactionModal
          accounts={accounts}
          onClose={() => setIsAddOpen(false)}
        />
      )}
    </AppLayout>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <OfflineNotice />
        <ProtectedApp />
      </AuthProvider>
    </LanguageProvider>
  );
}
