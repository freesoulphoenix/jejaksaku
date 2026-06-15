import { useEffect, useMemo, useState } from 'react';
import StatCard from '../components/StatCard.jsx';
import TransactionList from '../components/TransactionList.jsx';
import DueItem from '../components/DueItem.jsx';
import { getDashboardData } from '../services/dashboardService.js';
import { getUpcomingDue } from '../services/upcomingDueService.js';
import { formatCurrency, formatShortCurrency } from '../utils/format.js';

const chartPalette = ['#2196f3', '#26c6da', '#64b5f6', '#7986cb', '#9575cd', '#10b981'];

const emptyDashboard = {
  recentTransactions: [],
  summary: {
    assets: 0,
    debt: 0,
    netWorth: 0,
    todaySpending: 0,
    weekSpending: 0,
    monthSpending: 0,
    monthIncome: 0,
    dueThisMonth: 0
  },
  topSpendingCategories: [],
  spendingByAccount: [],
  spendingByProjectTag: []
};

function isThisMonth(dateString) {
  if (!dateString) {
    return false;
  }

  const dueDate = new Date(`${dateString}T00:00:00`);
  const today = new Date();

  return dueDate.getFullYear() === today.getFullYear()
    && dueDate.getMonth() === today.getMonth();
}

function getMeterWidth(value, maxValue) {
  if (Number(value || 0) <= 0 || Number(maxValue || 0) <= 0) {
    return '100%';
  }

  return `${Math.min((value / maxValue) * 100, 100)}%`;
}

export default function DashboardPage({ onNavigate }) {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [dueItems, setDueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDashboard() {
    setError('');
    setLoading(true);

    try {
      const [data, dueData] = await Promise.all([
        getDashboardData(),
        getUpcomingDue()
      ]);
      const unpaidDueItems = dueData.filter((item) => item.status !== 'paid');
      const dueThisMonth = unpaidDueItems
        .filter((item) => isThisMonth(item.due_date))
        .reduce((sum, item) => sum + Number(item.amount_due || 0), 0);

      setDashboard({
        ...data,
        summary: {
          ...data.summary,
          dueThisMonth
        }
      });
      setDueItems(unpaidDueItems);
    } catch (err) {
      setError(err.message || 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const { recentTransactions, spendingByAccount, spendingByProjectTag, summary, topSpendingCategories } = dashboard;
  const maxAccountSpend = Math.max(...spendingByAccount.map((item) => item.value), 1);
  const maxProjectTagSpend = Math.max(...spendingByProjectTag.map((item) => item.value), 1);
  const trendHeights = useMemo(() => {
    const values = topSpendingCategories.slice(0, 6).map((item) => item.value);
    const maxValue = Math.max(...values, 1);

    if (values.length === 0) {
      return [8, 8, 8, 8, 8, 8];
    }

    return values.map((value) => Math.max((value / maxValue) * 100, 8));
  }, [topSpendingCategories]);

  return (
    <div className="page-stack">
      {error && <p className="form-message error">{error}</p>}
      {loading && <p className="muted-copy">Loading dashboard...</p>}

      <section className="hero-card">
        <div>
          <p className="section-kicker">Net Worth</p>
          <h1>{formatCurrency(summary.netWorth)}</h1>
        </div>
        <div className="hero-metrics">
          <span>Assets <strong>{formatShortCurrency(summary.assets)}</strong></span>
          <span>Debt <strong>{formatShortCurrency(summary.debt)}</strong></span>
          <span>Due <strong>{formatShortCurrency(summary.dueThisMonth)}</strong></span>
        </div>
      </section>

      <section className="stat-grid">
        <StatCard label="Today" value={formatShortCurrency(summary.todaySpending)} tone="danger" />
        <StatCard label="This Week" value={formatShortCurrency(summary.weekSpending)} tone="danger" />
        <StatCard label="This Month" value={formatShortCurrency(summary.monthSpending)} tone="danger" />
        <StatCard label="Income" value={formatShortCurrency(summary.monthIncome)} tone="success" />
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Upcoming Due</h2>
            <button className="text-button" onClick={() => onNavigate('due')}>View all</button>
          </div>
          <div className="stack-list">
            {dueItems.slice(0, 3).map((item) => (
              <DueItem key={item.id} item={item} />
            ))}
            {dueItems.length === 0 && (
              <p className="muted-copy">No upcoming bills yet.</p>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Assets vs Debt</h2>
          </div>
          <div className="balance-bars">
            <div>
              <div className="bar-label"><span>Assets</span><strong>{formatCurrency(summary.assets)}</strong></div>
              <span className="progress-track">
                <span
                  className={`progress-fill success ${summary.assets <= 0 ? 'empty' : ''}`}
                  style={{ width: getMeterWidth(summary.assets, summary.assets) }}
                />
              </span>
            </div>
            <div>
              <div className="bar-label"><span>Debt</span><strong>{formatCurrency(summary.debt)}</strong></div>
              <span className="progress-track">
                <span
                  className={`progress-fill danger ${summary.debt <= 0 ? 'empty' : ''}`}
                  style={{ width: getMeterWidth(summary.debt, summary.assets) }}
                />
              </span>
            </div>
          </div>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Spending by Category</h2>
          </div>
          <div className="donut-row">
            <div className="donut-chart" aria-hidden="true" />
            <div className="legend-list">
              {topSpendingCategories.slice(0, 6).map((item, index) => (
                <span key={item.label}><i style={{ background: chartPalette[index % chartPalette.length] }} />{item.label}</span>
              ))}
              {topSpendingCategories.length === 0 && <span>No expense data yet</span>}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Monthly Trend</h2>
          </div>
          <div className="mini-chart">
            {trendHeights.map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Spending by Account</h2>
          </div>
          <div className="bar-list">
            {spendingByAccount.map((item) => (
              <div key={item.label}>
                <div className="bar-label"><span>{item.label}</span><strong>{formatShortCurrency(item.value)}</strong></div>
                <span className="progress-track"><span className="progress-fill info" style={{ width: `${(item.value / maxAccountSpend) * 100}%` }} /></span>
              </div>
            ))}
            {spendingByAccount.length === 0 && <p className="muted-copy">No account spending yet.</p>}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Recent Transactions</h2>
            <button className="text-button" onClick={() => onNavigate('transactions')}>View all</button>
          </div>
          <TransactionList transactions={recentTransactions} />
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Spending by Project Tag</h2>
          </div>
          <div className="bar-list">
            {spendingByProjectTag.map((item) => (
              <div key={item.label}>
                <div className="bar-label"><span>{item.label}</span><strong>{formatShortCurrency(item.value)}</strong></div>
                <span className="progress-track"><span className="progress-fill info" style={{ width: `${(item.value / maxProjectTagSpend) * 100}%` }} /></span>
              </div>
            ))}
            {spendingByProjectTag.length === 0 && <p className="muted-copy">No project tag spending yet.</p>}
          </div>
        </article>
      </section>
    </div>
  );
}
