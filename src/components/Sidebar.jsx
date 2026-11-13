import React from 'react';
import { NAV, SETTINGS, queue } from '../lib/data.js';
import { icon } from '../lib/utils.js';

export default function Sidebar({ route, open }) {
  const q = queue();
  return (
    <aside className={`side${open ? ' open' : ''}`} id="side" aria-label="Main navigation">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span>
          <span className="brand-name" id="brandName">{SETTINGS.store.name}</span><br />
          <span className="brand-sub">Admin</span>
        </span>
      </div>
      <nav className="nav" id="nav">
        {NAV.map(([group, items]) => (
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
