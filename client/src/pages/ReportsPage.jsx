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

function BreakdownList({ emptyText = 'No spending in this filter.', items }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  if (items.length === 0) {
    return <p className="muted-copy">{emptyText}</p>;
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

const chartColors = ['#2196f3', '#26c6da', '#66bb6a', '#f59e0b', '#ef4444', '#7c3aed', '#64748b', '#14b8a6'];

function buildPieBackground(items) {
  const total = items.reduce((sum, item) => sum + Math.abs(Number(item.value || 0)), 0);
  let cursor = 0;

  if (!total) {
    return '#eaf4fb';
  }

  return `conic-gradient(${items.map((item, index) => {
    const start = cursor;
    cursor += (Math.abs(Number(item.value || 0)) / total) * 100;
    return `${chartColors[index % chartColors.length]} ${start}% ${cursor}%`;
  }).join(', ')})`;
}

function buildYearlySeries(monthlySeries) {
  const years = new Map();

  monthlySeries.forEach((item) => {
    const year = String(item.monthKey || '').slice(0, 4) || item.month;
    const current = years.get(year) || {
      cashFlow: 0,
      income: 0,
      label: year,
      spending: 0
    };

    current.spending += item.spending || 0;
    current.income += item.income || 0;
    current.cashFlow += item.cashFlow || 0;
    years.set(year, current);
  });

  return [...years.values()];
}

function getPieItems({ monthlySeries, netWorthTrend }, valueKey, period) {
  if (valueKey === 'value') {
    if (period === 'yearly') {
      const yearlyNetWorth = new Map();

      netWorthTrend.forEach((item) => {
        const year = String(item.monthKey || '').slice(0, 4) || item.month;
        yearlyNetWorth.set(year, {
          label: year,
          value: Math.max(Number(item.value || 0), 0)
        });
      });

      return [...yearlyNetWorth.values()];
    }

    return netWorthTrend.map((item) => ({
      label: item.month,
      value: Math.max(Number(item.value || 0), 0)
    }));
  }

  const sourceItems = period === 'yearly'
    ? buildYearlySeries(monthlySeries)
    : monthlySeries.map((item) => ({ ...item, label: item.month }));

  return sourceItems.map((item) => ({
    label: item.label || item.month,
    value: Math.abs(Number(item[valueKey] || 0))
  })).filter((item) => item.value > 0);
}

function PieSummary({ items }) {
  const visibleItems = items.filter((item) => Number(item.value || 0) > 0).slice(-8);

  if (visibleItems.length === 0) {
    return <p className="muted-copy">No pie data yet.</p>;
  }

  return (
    <div className="report-pie-summary">
      <span
        aria-label="Report pie chart"
        className="report-pie-chart"
        role="img"
        style={{ background: buildPieBackground(visibleItems) }}
      />
      <div className="report-pie-legend">
        {visibleItems.map((item, index) => (
          <span key={`${item.label}-${item.value}`}>
            <i style={{ background: chartColors[index % chartColors.length] }} />
            <small>{item.label}</small>
            <strong>{formatShortCurrency(item.value)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function ReportChartPanel({ period, reportData, title, valueKey }) {
  const trendItems = valueKey === 'value'
    ? reportData.netWorthTrend.slice(-8)
    : reportData.monthlySeries.slice(-8);
  const pieItems = getPieItems(reportData, valueKey, period);

  return (
    <article className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
      </div>
      <PieSummary items={pieItems} />
      <MiniTrend items={trendItems} valueKey={valueKey} />
    </article>
  );
}

export default function ReportsPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [reportData, setReportData] = useState(null);
  const [reportPeriod, setReportPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const rows = reportData?.filteredTransactions || [];

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

          <div className="button-row compact report-period-toggle" role="tablist" aria-label="Report chart period">
            <button
              aria-selected={reportPeriod === 'monthly'}
              className={`secondary-button ${reportPeriod === 'monthly' ? 'active' : ''}`}
              onClick={() => setReportPeriod('monthly')}
              role="tab"
              type="button"
            >
              Monthly
            </button>
            <button
              aria-selected={reportPeriod === 'yearly'}
              className={`secondary-button ${reportPeriod === 'yearly' ? 'active' : ''}`}
              onClick={() => setReportPeriod('yearly')}
              role="tab"
              type="button"
            >
              Yearly
            </button>
          </div>

          <section className="content-grid">
            <ReportChartPanel period={reportPeriod} reportData={reportData} title="Monthly Spending" valueKey="spending" />
            <ReportChartPanel period={reportPeriod} reportData={reportData} title="Monthly Income" valueKey="income" />
            <ReportChartPanel period={reportPeriod} reportData={reportData} title="Cash Flow" valueKey="cashFlow" />
            <ReportChartPanel period={reportPeriod} reportData={reportData} title="Net Worth Trend" valueKey="value" />

            <article className="panel">
              <div className="panel-header">
                <h2>Top Category Breakdown</h2>
              </div>
              <BreakdownList items={reportData.topCategoryBreakdown} />
            </article>

            <article className="panel">
              <div className="panel-header">
                <h2>Income Breakdown</h2>
              </div>
              <PieSummary items={reportData.incomeBreakdown} />
              <BreakdownList emptyText="No income in this filter." items={reportData.incomeBreakdown} />
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

          <article className="panel net-worth-report-panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Full Position</p>
                <h2>Net Worth</h2>
              </div>
              <span className="summary-pill">{formatShortCurrency(reportData.netWorthSummary.netWorth)}</span>
            </div>
            <div className="balance-bars">
              <div>
                <div className="bar-label"><span>Assets</span><strong>{formatCurrency(reportData.netWorthSummary.assets)}</strong></div>
                <span className="progress-track">
                  <span
                    className={`progress-fill success ${reportData.netWorthSummary.assets <= 0 ? 'empty' : ''}`}
                    style={{ width: '100%' }}
                  />
                </span>
              </div>
              <div>
                <div className="bar-label"><span>Liabilities</span><strong>{formatCurrency(reportData.netWorthSummary.liabilities)}</strong></div>
                <span className="progress-track">
                  <span
                    className={`progress-fill danger ${reportData.netWorthSummary.liabilities <= 0 ? 'empty' : ''}`}
                    style={{
                      width: `${Math.min((reportData.netWorthSummary.liabilities / Math.max(reportData.netWorthSummary.assets, 1)) * 100, 100)}%`
                    }}
                  />
                </span>
              </div>
            </div>
          </article>
        </>
      )}
    </div>
  );
}
