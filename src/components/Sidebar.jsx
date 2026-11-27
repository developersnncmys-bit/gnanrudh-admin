import React from 'react';
import { NAV, SETTINGS, queue } from '../lib/data.js';
import { icon } from '../lib/utils.js';
import { NAV_PERM, can, currentRoleName } from '../lib/permissions.js';

// SEC-05: hide nav entries the current role doesn't have permission for.
// Groups whose items all get filtered out drop out entirely so the sidebar
// doesn't leave a bare "Sales" header above nothing.
//
// Whitelist semantics: an entry without a NAV_PERM mapping is shown to
// everyone (there are none today, but keeps future additions forgiving).
// Before the /auth/me response lands currentRoleName() is null — render the
// full nav in that window so the menu doesn't flash empty for a frame.
function filterNavForRole(nav) {
  if (!currentRoleName()) return nav;
  return nav
    .map(([group, items]) => {
      const allowed = items.filter(([id]) => {
        const perm = NAV_PERM[id];
        return !perm || can(perm);
      });
      return [group, allowed];
    })
    .filter(([, items]) => items.length > 0);
}

export default function Sidebar({ route, open }) {
  const q = queue();
  const visibleNav = filterNavForRole(NAV);
  return (
    <aside className={`side${open ? ' open' : ''}`} id="side" aria-label="Main navigation">
      <div className="brand">
        <img
          className="brand-mark"
          src="/images/gnanrudh-light-logo.jpeg"
          alt=""
          aria-hidden="true"
        />
        <span>
          <span className="brand-name" id="brandName">{SETTINGS.store.name}</span><br />
          <span className="brand-sub">Admin</span>
        </span>
      </div>
      <nav className="nav" id="nav">
        {visibleNav.map(([group, items]) => (
          <div className="nav-group" key={group}>
            <div className="nav-title">{group}</div>
            {items.map(([id, label, ic, badge, hot]) => {
              const n = badge ? badge(q) : 0;
              return (
                <a
                  key={id}
                  href={`/${id}`}
                  data-nav={id}
                  {...(route === id ? { 'aria-current': 'page' } : {})}
                >
                  <span dangerouslySetInnerHTML={{ __html: icon(ic) }} />
                  <span>{label}</span>
                  {n ? <span className={`badge${hot ? ' hot' : ''}`}>{n}</span> : null}
                </a>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
