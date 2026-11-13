import { useState } from 'react';
import { api, auth } from '../lib/api.js';

export default function LoginPage({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const { token, user } = await api.auth.login(email.trim(), password);
      auth.set(token);
      onSignedIn(user);
    } catch (err) {
      setError(err.message || 'Could not sign in');
      setBusy(false);
    }
  };

  return (
    <div className="login-split">
      {/* Hero / brand column */}
      <aside className="login-hero">
        <div className="login-hero-weave" aria-hidden="true" />

        <div className="login-hero-top">
          <div className="login-logo-ring">
            <img src="/images/gnanrudh-logo.jpeg" alt="House of GnanRudh" className="login-logo" />
          </div>
          <div className="login-brand-text">
            <div className="login-brand-name">House of GnanRudh</div>
            <div className="login-brand-tag">Woven to be worn. Not just owned.</div>
          </div>
        </div>

        <div className="login-hero-body">
          <span className="login-eyebrow">Admin portal</span>
          <h1 className="login-hero-title">Run the house<br />from one place.</h1>
          <p className="login-hero-lede">
            Orders, stock, customers, returns and the storefront — managed in real time.
          </p>

          <ul className="login-features">
            <li>
              <span className="login-feat-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              Live order, return and shipping queues
            </li>
            <li>
              <span className="login-feat-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              Catalogue, categories and pricing control
            </li>
            <li>
              <span className="login-feat-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              Customer CRM with lifetime-value segments
            </li>
            <li>
              <span className="login-feat-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              Journal, storefront pages and featured weaves
            </li>
          </ul>

          <figure className="login-quote">
            <blockquote>“Every drape has a story. We just help you ship it.”</blockquote>
            <figcaption>— The GnanRudh atelier</figcaption>
          </figure>
        </div>

        <div className="login-hero-foot">
          <span>© {new Date().getFullYear()} House of GnanRudh</span>
          <span className="login-version">Admin v1.0</span>
        </div>
      </aside>

      {/* Form column */}
      <main className="login-pane">
        <form className="login-card" onSubmit={submit}>
          <div className="login-welcome">Welcome back</div>
          <h2 className="login-title">Sign in to continue</h2>
          <p className="login-sub">Enter your admin credentials below.</p>

          <div className="field" style={{ marginTop: 22 }}>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="ctl"
              type="email"
              autoComplete="username"
              placeholder="you@houseofgnanrudh.com"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="login-password">Password</label>
            <div className="pw-wrap">
              <input
                id="login-password"
                className="ctl"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 5.17-5.94" />
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.77 19.77 0 0 1-3.17 4.19" />
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <label className="login-remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Keep me signed in on this device</span>
          </label>

          {error ? <p className="note n-bad" style={{ marginTop: 14 }}>{error}</p> : null}

          <button type="submit" className="btn btn-pri login-submit" disabled={busy}>
            {busy ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </>
            )}
          </button>

          <p className="login-help">
            Trouble signing in? <a href="mailto:care@houseofgnanrudh.com">care@houseofgnanrudh.com</a>
          </p>
        </form>
      </main>
    </div>
  );
}
