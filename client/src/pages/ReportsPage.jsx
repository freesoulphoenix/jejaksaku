import { useEffect, useMemo, useState } from 'react';
import useRefreshOnResume from '../hooks/useRefreshOnResume.js';
import { getReportData } from '../services/reportService.js';
import { getCategoryOptions } from '../utils/categoryOptions.js';
import { getTransactionAccountName } from '../utils/balance.js';
import { formatCurrency, formatShortCurrency } from '../utils/format.js';

const emptyFilters = {
  accountId: '',
  categoryId: '',
  endDate: '',
  projectTagId: '',
  startDate: ''
};

function BreakdownList({ items }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  if (items.length === 0) {
    return <p className="muted-copy">No spending in this filter.</p>;
  }

  return (
    <div className="bar-list">
      {items.map((item) => (
        <div key={item.label}>
          <div className="bar-label">
            <span>{item.label}</span>
            <strong>{formatShortCurrency(item.value)}</strong>
          </div>
          <span className="progress-track">
            <span className="progress-fill info" style={{ width: `${(item.value / max) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniTrend({ items, valueKey = 'value' }) {
  const max = Math.max(...items.map((item) => Math.abs(item[valueKey] || 0)), 1);

  if (items.length === 0) {
    return <p className="muted-copy">No trend data yet.</p>;
  }

  return (
    <div className="wide-chart report-trend-chart">
      {items.map((item) => (
        <span
          key={`${item.month}-${item[valueKey]}`}
          style={{ height: `${Math.max((Math.abs(item[valueKey] || 0) / max) * 100, 8)}%` }}
          title={`${item.month}: ${formatCurrency(item[valueKey] || 0)}`}
        />
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const rows = reportData?.filteredTransactions || [];

  const visibleMonthlySeries = useMemo(() => (
    reportData?.monthlySeries?.slice(-8) || []
  ), [reportData]);
  const categoryOptions = useMemo(() => (
    getCategoryOptions(reportData?.categories || [])
  ), [reportData?.categories]);

  async function loadReports(nextFilters = filters, background = false) {
    setError('');
    if (!background) setLoading(true);

    try {
      const data = await getReportData(nextFilters);
      setReportData(data);
    } catch (err) {
      setError(err.message || 'Unable to load reports.');
    } finally {
      if (!background) setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  useRefreshOnResume(() => loadReports(filters, true));

  function updateFilter(field, value) {
    const nextFilters = {
      ...filters,
      [field]: value
    };
    setFilters(nextFilters);
    loadReports(nextFilters);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    loadReports(emptyFilters);
  }

  async function exportSpreadsheet() {
    if (!reportData) {
      return;
    }

    const XLSX = await import('xlsx');
    const worksheetRows = rows.map((transaction) => ({
      Date: transaction.transaction_date || '',
      Type: transaction.transaction_type || '',
      Description: transaction.description || '',
      Account: getTransactionAccountName(transaction),
      Category: transaction.categories?.name || '',
      'Project Tag': transaction.project_tags?.name || '',
      Amount: Number(transaction.amount || 0)
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(worksheetRows);

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
    XLSX.writeFile(workbook, 'jejaksaku-report.xlsx');
  }

  function exportPdf() {
    if (!reportData) {
      return;
    }

    const reportWindow = window.open('', '_blank');

    if (!reportWindow) {
      setError('Allow popups to export PDF.');
      return;
    }

    reportWindow.document.write(`
      <html>
        <head>
          <title>Jejak Saku Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f2747; padding: 32px; }
            h1 { margin: 0 0 16px; }
            h2 { margin-top: 28px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border-bottom: 1px solid #d9e8f5; padding: 8px; text-align: left; }
            th { background: #eaf6ff; }
          </style>
        </head>
        <body>
          <h1>Jejak Saku Report</h1>
          <p>Spending: ${formatCurrency(reportData.monthlySpending)} | Income: ${formatCurrency(reportData.monthlyIncome)} | Cash Flow: ${formatCurrency(reportData.cashFlow)}</p>
          <h2>Transactions</h2>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Account</th><th>Category</th><th>Project</th><th>Amount</th></tr></thead>
            <tbody>
              ${rows.map((transaction) => `
                <tr>
                  <td>${transaction.transaction_date || ''}</td>
                  <td>${transaction.transaction_type || ''}</td>
                  <td>${transaction.description || ''}</td>
                  <td>${getTransactionAccountName(transaction)}</td>
                  <td>${transaction.categories?.name || ''}</td>
                  <td>${transaction.project_tags?.name || ''}</td>
                  <td>${formatCurrency(transaction.amount || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="section-kicker">Insights</p>
          <h1>Reports</h1>
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={exportSpreadsheet}>Export Excel</button>
          <button className="secondary-button" onClick={exportPdf}>Export PDF</button>
        </div>
      </section>

      {error && <p className="form-message error">{error}</p>}

      <section className="filter-panel report-filter-panel">
        <input
          onChange={(event) => updateFilter('startDate', event.target.value)}
          type="date"
          value={filters.startDate}
        />
        <input
          onChange={(event) => updateFilter('endDate', event.target.value)}
          type="date"
          value={filters.endDate}
        />
        <select onChange={(event) => updateFilter('accountId', event.target.value)} value={filters.accountId}>
          <option value="">All accounts</option>
          {reportData?.accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </select>
        <select onChange={(event) => updateFilter('categoryId', event.target.value)} value={filters.categoryId}>
          <option value="">All categories</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>{category.displayName}</option>
          ))}
        </select>
        <select onChange={(event) => updateFilter('projectTagId', event.target.value)} value={filters.projectTagId}>
          <option value="">All project tags</option>
          {reportData?.projectTags.map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>
        <button className="secondary-button" onClick={resetFilters}>Reset</button>
      </section>

      {loading ? (
        <p className="muted-copy">Loading reports...</p>
      ) : (
        <>
          <section className="stat-grid">
            <article className="report-card">
              <span>Monthly Spending</span>
              <strong>{formatShortCurrency(reportData.monthlySpending)}</strong>
            </article>
            <article className="report-card success">
              <span>Monthly Income</span>
              <strong>{formatShortCurrency(reportData.monthlyIncome)}</strong>
            </article>
            <article className="report-card">
              <span>Cash Flow</span>
              <strong>{formatShortCurrency(reportData.cashFlow)}</strong>
            </article>
            <article className="report-card">
              <span>Filtered Transactions</span>
              <strong>{rows.length}</strong>
            </article>
          </section>

          <section className="content-grid">
            <article className="panel">
              <div className="panel-header">
                <h2>Monthly Spending</h2>
              </div>
              <MiniTrend items={visibleMonthlySeries} valueKey="spending" />
            </article>

            <article className="panel">
              <div className="panel-header">
                <h2>Monthly Income</h2>
              </div>
              <MiniTrend items={visibleMonthlySeries} valueKey="income" />
            </article>

            <article className="panel">
              <div className="panel-header">
                <h2>Cash Flow</h2>
              </div>
              <MiniTrend items={visibleMonthlySeries} valueKey="cashFlow" />
            </article>

            <article className="panel">
              <div className="panel-header">
                <h2>Net Worth Trend</h2>
              </div>
              <MiniTrend items={reportData.netWorthTrend.slice(-8)} />
            </article>

            <article className="panel">
              <div className="panel-header">
                <h2>Category Breakdown</h2>
              </div>
              <BreakdownList items={reportData.categoryBreakdown} />
            </article>

            <article className="panel">
              <div className="panel-header">
                <h2>Account Breakdown</h2>
              </div>
              <BreakdownList items={reportData.accountBreakdown} />
            </article>

            <article className="panel">
              <div className="panel-header">
                <h2>Project Tag Breakdown</h2>
              </div>
              <BreakdownList items={reportData.projectTagBreakdown} />
            </article>
          </section>
        </>
      )}
    </div>
  );
}
