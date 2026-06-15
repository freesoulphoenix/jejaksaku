export default function SettingsPage({ onLogout, user }) {
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="section-kicker">Preferences</p>
          <h1>Settings</h1>
        </div>
      </section>

      <section className="settings-grid">
        <article className="panel">
          <h2>Account</h2>
          <p className="muted-copy">{user?.email}</p>
          <div className="button-row">
            <button className="secondary-button" onClick={onLogout}>Logout</button>
          </div>
        </article>

        <article className="panel">
          <h2>Receipt Storage</h2>
          <label className="setting-row">
            <span>Keep receipt image after import</span>
            <input type="checkbox" defaultChecked />
          </label>
          <label className="field-group">
            Auto-delete receipts
            <select defaultValue="never">
              <option value="never">Never</option>
              <option value="3m">After 3 months</option>
              <option value="1y">After 1 year</option>
            </select>
          </label>
        </article>

        <article className="panel">
          <h2>Backup</h2>
          <p className="muted-copy">Export and import controls will connect to Dompet Daily data services later.</p>
          <div className="button-row">
            <button className="secondary-button">Export</button>
            <button className="secondary-button">Import</button>
          </div>
        </article>
      </section>
    </div>
  );
}
