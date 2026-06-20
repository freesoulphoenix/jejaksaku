import BrandMark from './BrandMark.jsx';

export default function Header({ onLogout, onNavigate, user }) {
  return (
    <header className="top-header">
      <div className="brand-lockup">
        <BrandMark />
        <div>
          <strong>Jejak Dana</strong>
          <small>Access your daily expense workspace.</small>
        </div>
      </div>
      <div className="header-actions">
        <span className="user-chip">{user?.email}</span>
        <button className="mobile-header-button" aria-label="Home" onClick={() => onNavigate('dashboard')} type="button">
          <i className="fi fi-rr-home" aria-hidden="true" />
        </button>
        <button className="mobile-header-button" aria-label="Settings" onClick={() => onNavigate('settings')} type="button">
          <i className="fi fi-rr-settings" aria-hidden="true" />
        </button>
        <button className="logout-button" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}
