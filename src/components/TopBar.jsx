import React from 'react';

export default function TopBar({ onMenu, onSearch, onBell, onSignOut }) {
  return (
    <header className="top">
      <button
        type="button"
        className="btn btn-ghost btn-icon menu-btn"
        id="menuBtn"
        aria-label="Open navigation"
        onClick={onMenu}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <button
        type="button"
        className="cmd"
        id="cmdBtn"
        aria-label="Search orders, products and customers"
        onClick={onSearch}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="cmd-text">Search orders, products, customers, SKUs, phone numbers</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div className="top-right">
        <a className="btn btn-ghost btn-sm" href="/" data-act="viewStore">View store</a>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          id="bellBtn"
          aria-label="Notifications"
          onClick={onBell}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
        <div className="me">
          <span className="avatar av0">G</span>
          <span>
            <span className="me-name">GnanRudh Admin</span><br />
            <span className="me-role">Signed in</span>
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
}
