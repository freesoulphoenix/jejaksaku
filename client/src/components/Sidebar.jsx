import { navItems } from '../utils/navigation.js';

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`nav-button ${activePage === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </aside>
  );
}
