import { useEffect, useRef, useState, useCallback } from 'react';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import { PAGES } from './lib/pages.js';
import {
  openEntity, closeDrawer, productDrawer, articleDrawer, categoryDrawer,
  getDraftP, readProductForm,
} from './lib/drawers.js';
import { buildActions, openPalette, renderPalette, choosePalette, CHECK_ACTS, toast, ask, handleScan } from './lib/actions.js';
import { installGlobalScanner } from './lib/scanner.js';
import { LV } from './lib/renderers.js';
import { debounce, esc, iso, TODAY } from './lib/utils.js';
import { SETTINGS, notifications, CAT, journal, PAGES_CMS, OCCASIONS_FULL, bootstrap } from './lib/data.js';
import { api, auth, onAuthExpired } from './lib/api.js';
import LoginPage from './components/LoginPage.jsx';

// Parse the current URL into [page, entityRef]. Accepts both clean (/orders/GR123)
// and legacy hash (#/orders/GR123) forms so old bookmarks still work.
// Phase 4 URL aliases: kebab-case paths map to the admin's camelCase page keys.
const PAGE_ALIASES = { 'price-ranges': 'priceRanges', 'product-analytics': 'productAnalytics' };
function parseLocation() {
  const hash = String(window.location.hash || '').replace(/^#\/?/, '');
  const source = hash || String(window.location.pathname || '').replace(/^\/+/, '');
  const parts = source.split('/').filter(Boolean);
  if (parts[0] && PAGE_ALIASES[parts[0]]) parts[0] = PAGE_ALIASES[parts[0]];
  return parts;
}

function App() {
  const [route, setRoute] = useState(() => {
    const [h] = parseLocation();
    return h && PAGES[h] ? h : 'dashboard';
  });
  const [sideOpen, setSideOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(() => Boolean(auth.get()));
  const [bootState, setBootState] = useState({ status: 'loading', error: null });
  const [, forceRender] = useState(0);
  const routeRef = useRef(route);
  routeRef.current = route;

  const contentRef = useRef(null);
  const popRef = useRef(null);

  const rerender = useCallback(() => forceRender((n) => n + 1), []);
  const renderPage = useCallback(() => forceRender((n) => n + 1), []);
  const renderNav = useCallback(() => forceRender((n) => n + 1), []);

  // Accepts "/orders", "orders", or "#/orders" — all are treated the same.
  const navigate = useCallback((to) => {
    const clean = String(to || '').replace(/^#?\/?/, '');
    const path = '/' + clean;
    try { if (window.location.pathname !== path) window.history.pushState(null, '', path); } catch { /* sandboxed */ }
    go(path);
  }, []);

  const go = useCallback((_to) => {
    const h = parseLocation();
    const next = h[0] && PAGES[h[0]] ? h[0] : 'dashboard';
    setRoute(next);
    setSideOpen(false);
    closeDrawer(true);
    try { window.scrollTo(0, 0); } catch { /* ignore */ }
    setTimeout(() => contentRef.current?.focus({ preventScroll: true }), 0);
    // ORD-02: support /orders/:id, /customers/:id, /products/:id deep links.
    // Map the route to the entity kind openEntity expects (`order:<id>` etc).
    const KIND_FROM_ROUTE = { orders: 'order', customers: 'customer', products: 'product', returns: 'return', journal: 'article' };
    if (h[1]) {
      const kind = KIND_FROM_ROUTE[next];
      const ref = kind ? `${kind}:${decodeURIComponent(h[1])}` : decodeURIComponent(h[1]);
      openEntity(ref);
    }
  }, []);

  // Fetch everything from the backend once the user is signed in
  useEffect(() => {
    if (!signedIn) { setBootState({ status: 'loading', error: null }); return; }
    let cancelled = false;
    bootstrap()
      .then(() => { if (!cancelled) setBootState({ status: 'ready', error: null }); })
      .catch((err) => { if (!cancelled) setBootState({ status: 'error', error: err.message }); });
    return () => { cancelled = true; };
  }, [signedIn]);

  // Any protected API call returning 401 flips us back to the login screen
  useEffect(() => onAuthExpired(() => setSignedIn(false)), []);

  const signOut = useCallback(async () => {
    const confirmed = await ask({
      title: 'Sign out?',
      text: 'You’ll need to enter your email and password again to get back in.',
      ok: 'Sign out',
      danger: true,
    });
    if (!confirmed) return;
    auth.clear();
    setSignedIn(false);
    setBootState({ status: 'loading', error: null });
  }, []);

  // Build the actions object once we have the stable callbacks
  const actionsRef = useRef(null);
  useEffect(() => {
    actionsRef.current = buildActions({ rerender, renderPage, renderNav, navigate, routeRef });
  }, [rerender, renderPage, renderNav, navigate]);

  // Set document title
  useEffect(() => {
    const t = contentRef.current?.querySelector('.h1');
    document.title = `${t ? t.textContent : 'Admin'} · ${SETTINGS.store.name}`;
  });

  // Back/forward navigation + legacy hash redirect (one-time)
  useEffect(() => {
    // If someone lands on a legacy #/orders URL, rewrite it to /orders once.
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      const clean = '/' + window.location.hash.replace(/^#\/?/, '');
      try { window.history.replaceState(null, '', clean); } catch { /* ignore */ }
    }
    const onPop = () => go();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [go]);

  // Global click event delegation (matches the original)
  useEffect(() => {
    const onClick = (e) => {
      // Catch both clean (/orders) and legacy hash (#/orders) internal links.
      // Skip external links and modifier-clicks so Ctrl+Click opens a new tab.
      const link = e.target.closest('a[href]');
      if (link && !link.dataset.act && !e.ctrlKey && !e.metaKey && !e.shiftKey && link.target !== '_blank') {
        const href = link.getAttribute('href') || '';
        const isHash = href.startsWith('#/');
        const isInternal = href.startsWith('/') && !href.startsWith('//');
        if (isHash || isInternal) {
          e.preventDefault();
          if (popRef.current) popRef.current.hidden = true;
          return navigate(href);
        }
      }
      const lvEl = e.target.closest('[data-lv]');
      if (lvEl && !lvEl.matches('input[data-lv-q], select')) {
        const id = lvEl.dataset.lv; const s = LV[id];
        if (!s) return;
        if (lvEl.dataset.lvTab) { s.tab = lvEl.dataset.lvTab; s.sel.clear(); return renderPage(); }
        if (lvEl.dataset.lvSort) { const k = lvEl.dataset.lvSort; s.sort = s.sort?.key !== k ? { key: k, dir: 'asc' } : s.sort.dir === 'asc' ? { key: k, dir: 'desc' } : null; return renderPage(); }
        if (lvEl.hasAttribute('data-lv-clear')) { s.sel.clear(); return renderPage(); }
      }
      const act = e.target.closest('[data-act]');
      const A = actionsRef.current;
      if (act && A && A[act.dataset.act] && !(act.tagName === 'INPUT' && act.type === 'checkbox' && CHECK_ACTS.includes(act.dataset.act))) {
        if (act.tagName === 'A') e.preventDefault();
        return A[act.dataset.act](act, e);
      }
      const open = e.target.closest('[data-open]');
      if (open && !e.target.closest('input[type="checkbox"], [data-act]')) {
        // ORD-02: push a shareable URL that matches the drawer kind, then open it.
        const ref = open.dataset.open;
        const [kind, id] = ref.split(':');
        const ROUTE_FROM_KIND = { order: 'orders', customer: 'customers', product: 'products', return: 'returns', article: 'journal' };
        const path = ROUTE_FROM_KIND[kind] && id ? `/${ROUTE_FROM_KIND[kind]}/${encodeURIComponent(id)}` : null;
        if (path) { try { if (window.location.pathname !== path) window.history.pushState(null, '', path); } catch { /* ignore */ } }
        return openEntity(ref);
      }
    };
    document.addEventListener('click', onClick);
    // A11Y-01: list rows have tabindex=0 + role=link. Enter/Space opens them with the
    // same code path as a click so operators can drive the admin from the keyboard.
    const onKey = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('tr[data-open]');
      if (!row || e.target.closest('input, button, a, select, textarea, [data-act]')) return;
      e.preventDefault();
      const ref = row.dataset.open;
      const [kind, id] = ref.split(':');
      const ROUTE_FROM_KIND = { order: 'orders', customer: 'customers', product: 'products', return: 'returns', article: 'journal' };
      const path = ROUTE_FROM_KIND[kind] && id ? `/${ROUTE_FROM_KIND[kind]}/${encodeURIComponent(id)}` : null;
      if (path) { try { if (window.location.pathname !== path) window.history.pushState(null, '', path); } catch { /* ignore */ } }
      openEntity(ref);
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, [navigate, renderPage]);

  // Global change delegation
  useEffect(() => {
    const onChange = (e) => {
      const el = e.target;
      const A = actionsRef.current;
      if (el.dataset.lvF) { LV[el.dataset.lv].f[el.dataset.lvF] = el.value; return renderPage(); }
      if (el.dataset.lvSel) { const s = LV[el.dataset.lv].sel; el.checked ? s.add(el.dataset.lvSel) : s.delete(el.dataset.lvSel); return renderPage(); }
      if (el.hasAttribute('data-lv-all')) { const id = el.dataset.lv; const rows = [...document.querySelectorAll(`[data-lv="${id}"][data-lv-sel]`)].map((x) => x.dataset.lvSel); rows.forEach((r) => (el.checked ? LV[id].sel.add(r) : LV[id].sel.delete(r))); return renderPage(); }
      if (CHECK_ACTS.includes(el.dataset.act) && A) A[el.dataset.act](el);

      // Product form live-reactive inputs
      if (el.id === 'pf-cat') {
        readProductForm();
        const dp = getDraftP();
        dp.cat = el.value;
        const c = CAT[el.value];
        dp.weave = c.weaves[0];
        if (!c.saree) { dp.blousePiece = false; dp.zari = null; }
        else if (!dp.zari) dp.zari = 'No zari';
        productDrawer('__redraw');
      }
      if (el.id === 'pf-files' && el.files?.length) {
        readProductForm();
        const dp = getDraftP();
        const files = [...el.files];
        toast(`Uploading ${files.length} image${files.length > 1 ? 's' : ''}…`);
        api.uploads.upload(files)
          .then(({ files: uploaded }) => {
            uploaded.forEach(({ url }) => { dp.imageUrls[dp.images] = url; dp.images += 1; });
            productDrawer('__redraw');
            toast(`Uploaded ${uploaded.length} image${uploaded.length > 1 ? 's' : ''}.`);
          })
          .catch((err) => toast(`Upload failed: ${err.message}`));
        el.value = '';
      }
      if (el.id === 'pf-video' && el.files?.length) {
        readProductForm();
        const dp = getDraftP();
        const f = el.files[0];
        toast('Uploading video…');
        api.uploads.upload([f])
          .then(({ files: [uploaded] }) => {
            dp.video = true; dp.videoName = f.name; dp.videoUrl = uploaded.url;
            productDrawer('__redraw');
            toast('Video uploaded.');
          })
          .catch((err) => toast(`Upload failed: ${err.message}`));
        el.value = '';
      }
      if (el.id === 'aj-cover' && el.files?.length) {
        const file = el.files[0];
        const img = el.parentElement.querySelector('img') || el.parentElement.insertBefore(Object.assign(document.createElement('img'), { alt: '', style: 'width:64px;height:40px;object-fit:cover;border-radius:4px' }), el.parentElement.firstChild);
        toast('Uploading cover…');
        api.uploads.upload([file])
          .then(({ files: [uploaded] }) => {
            const url = uploaded.url;
            const j = journal.find((x) => x.id === el.dataset.article);
            if (j) j.cover = url; else articleDrawer.cover = url;
            img.src = url;
          })
          .catch((err) => toast(`Upload failed: ${err.message}`));
        el.value = '';
      }
      if (el.id === 'cat-image' && el.files?.length) {
        const file = el.files[0];
        const preview = document.getElementById('cat-img-preview');
        toast('Uploading category image…');
        api.uploads.upload([file])
          .then(({ files: [uploaded] }) => {
            const url = uploaded.url;
            const cid = el.dataset.cat;
            if (cid && cid !== 'new' && CAT[cid]) CAT[cid].image = url;
            // Stash for saveCategory (covers the brand-new case where CAT[id] doesn't exist yet).
            categoryDrawer.image = url;
            if (preview) preview.innerHTML = `<img src="${url}" alt="">`;
            toast('Category image updated.');
          })
          .catch((err) => toast(`Upload failed: ${err.message}`));
        el.value = '';
      }
      if (el.dataset.occImg && el.files?.length) {
        const name = el.dataset.occImg;
        const file = el.files[0];
        toast(`Uploading image for ${name}…`);
        api.uploads.upload([file])
          .then(({ files: [uploaded] }) => {
            const o = OCCASIONS_FULL.find((x) => x.name === name);
            if (o) o.image = uploaded.url;
            renderPage();
            toast('Image uploaded.');
            return api.occasions.setImage(name, uploaded.url);
          })
          .catch((err) => toast(`Upload failed: ${err.message}`));
        el.value = '';
      }
      if (el.id.startsWith('pg-banner-') && el.files?.length) {
        const i = Number(el.dataset.i);
        const file = el.files[0];
        const page = PAGES_CMS[i];
        toast(`Uploading banner for ${page.name}…`);
        api.uploads.upload([file])
          .then(({ files: [uploaded] }) => {
            page.banner = uploaded.url;
            page.updated = iso(TODAY);
            renderPage();
            toast(`${page.name} banner updated.`);
            api.pages.update(page.name, { name: page.name, desc: page.desc, body: page.body, banner: page.banner })
              .catch((err) => toast(`Save failed: ${err.message}`));
          })
          .catch((err) => toast(`Upload failed: ${err.message}`));
        el.value = '';
      }
      if (el.id === 'pm-pins' && el.files?.length) {
        const f = el.files[0];
        f.text().then((txt) => {
          const pins = new Set((txt.match(/\b\d{6}\b/g) || []));
          if (!pins.size) return toast(`No 6-digit pincodes found in ${f.name}. The list wasn’t changed.`);
          SETTINGS.pay.codPins = pins.size; SETTINGS.pay.codFile = f.name;
          renderPage(); toast(`COD list replaced with ${pins.size} pincodes from ${f.name}.`);
        });
      }
    };
    document.addEventListener('change', onChange);
    return () => document.removeEventListener('change', onChange);
  }, [renderPage]);

  // Live search input delegation
  useEffect(() => {
    const onSearch = debounce((el) => {
      const id = el.dataset.lv; if (!LV[id]) return;
      LV[id].q = el.value;
      const pos = el.selectionStart;
      renderPage();
      setTimeout(() => {
        const ne = document.getElementById(`lvq-${id}`);
        if (ne) { ne.focus(); try { ne.setSelectionRange(pos, pos); } catch { /* ignore */ } }
      }, 0);
    }, 250);
    const onInput = (e) => {
      if (e.target.hasAttribute('data-lv-q')) onSearch(e.target);
      if (e.target.id === 'aj-seot') document.getElementById('aj-seot-n').textContent = `${e.target.value.length} of about 60 characters`;
      if (e.target.id === 'aj-seod') document.getElementById('aj-seod-n').textContent = `${e.target.value.length} of about 155 characters`;
    };
    document.addEventListener('input', onInput);
    return () => document.removeEventListener('input', onInput);
  }, [renderPage]);

  // Keyboard shortcuts (Ctrl/Cmd+K, Escape)
  useEffect(() => {
    if (!signedIn) return;
    const onKey = (e) => {
      const dlg = document.getElementById('dlg');
      const palette = document.getElementById('palette');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
      if (e.key === 'Escape' && dlg && !dlg.open && palette && !palette.open) {
        closeDrawer();
        if (popRef.current) popRef.current.hidden = true;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [signedIn]);

  // Global keyboard-wedge scanner (USB/Bluetooth). Fast bursts ending in Enter
  // are treated as scans; dedicated `data-scan` inputs (packing bench, setup
  // test) consume the burst themselves.
  useEffect(() => {
    if (!signedIn) return;
    const unsubscribe = installGlobalScanner((raw, meta) => {
      handleScan(raw, { navigate, renderPage, renderNav, source: meta?.source });
    });
    return unsubscribe;
  }, [signedIn, navigate, renderPage, renderNav]);

  // Palette interaction + bell popover + scrim close.
  // Only runs once signed in, because the DOM elements below live inside
  // the main shell which is not rendered on the login page.
  useEffect(() => {
    if (!signedIn) return;
    const palInput = document.getElementById('palInput');
    const palRes = document.getElementById('palRes');
    const palette = document.getElementById('palette');
    if (!palInput || !palRes || !palette) return;

    const onPalInput = (e) => renderPalette(e.target.value);
    const onPalKey = (e) => {
      const items = [...palRes.querySelectorAll('.pal-item')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        // Using module-level palSel in actions.js — but for simplicity, we use local
        const current = items.findIndex((b) => b.getAttribute('aria-selected') === 'true');
        const next = ((current < 0 ? 0 : current) + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length);
        items.forEach((b, i) => b.setAttribute('aria-selected', String(i === next)));
        items[next]?.scrollIntoView({ block: 'nearest' });
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const sel = items.findIndex((b) => b.getAttribute('aria-selected') === 'true');
        choosePalette(sel < 0 ? 0 : sel, navigate);
      }
    };
    const onPalResClick = (e) => { const b = e.target.closest('[data-pal]'); if (b) choosePalette(Number(b.dataset.pal), navigate); };
    const onPaletteBgClick = (e) => { if (e.target === palette) palette.close(); };
    const onScrim = () => closeDrawer();
    const onDocMouseDown = (e) => { if (!e.target.closest('#pop, #bellBtn') && popRef.current) popRef.current.hidden = true; };

    palInput.addEventListener('input', onPalInput);
    palInput.addEventListener('keydown', onPalKey);
    palRes.addEventListener('click', onPalResClick);
    palette.addEventListener('click', onPaletteBgClick);
    const scrim = document.getElementById('scrim');
    scrim.addEventListener('click', onScrim);
    document.addEventListener('mousedown', onDocMouseDown);

    return () => {
      palInput.removeEventListener('input', onPalInput);
      palInput.removeEventListener('keydown', onPalKey);
      palRes.removeEventListener('click', onPalResClick);
      palette.removeEventListener('click', onPaletteBgClick);
      scrim.removeEventListener('click', onScrim);
      document.removeEventListener('mousedown', onDocMouseDown);
    };
  }, [navigate, signedIn]);

  const onBell = useCallback((e) => {
    const pop = popRef.current;
    if (!pop.hidden) { pop.hidden = true; return; }
    pop.innerHTML = `<div style="width:340px;padding:4px">${notifications.map(([t, href, m]) => `<a class="mi" href="/${href}" style="color:inherit;text-decoration:none;display:block"><b style="font-weight:600">${esc(t)}</b><span class="sub">${m < 60 ? `${m} minutes ago` : `${Math.round(m / 60)} hours ago`}</span></a>`).join('')}</div>`;
    pop.hidden = false;
    const r = e.currentTarget.getBoundingClientRect();
    pop.style.top = `${r.bottom + 8}px`;
    pop.style.left = `${Math.max(8, r.right - 352)}px`;
  }, []);

  const pageHtml = bootState.status === 'ready' && PAGES[route] ? PAGES[route]() : '';

  if (!signedIn) {
    return <LoginPage onSignedIn={() => setSignedIn(true)} />;
  }

  return (
    <>
      <div className="shell">
        <Sidebar route={route} open={sideOpen} />
        <div className="main">
          <TopBar onMenu={() => setSideOpen((v) => !v)} onSearch={openPalette} onBell={onBell} onSignOut={signOut} />
          {bootState.status === 'loading' ? (
            <main className="content"><p className="lede">Loading data from the server…</p></main>
          ) : bootState.status === 'error' ? (
            <main className="content">
              <h1 className="h1">Could not reach the API</h1>
              <p className="note n-bad" style={{ marginTop: 12 }}>{bootState.error}</p>
              <p className="muted" style={{ marginTop: 10 }}>
                Make sure the backend is running at <code>{import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}</code>,
                then refresh.
              </p>
            </main>
          ) : (
            <main
              className="content"
              id="content"
              tabIndex={-1}
              ref={contentRef}
              dangerouslySetInnerHTML={{ __html: pageHtml }}
            />
          )}
        </div>
      </div>

      <div className="scrim" id="scrim" hidden />
      <aside className="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle" aria-hidden="true" />
      <div className="pop" id="pop" ref={popRef} hidden />

      <dialog id="dlg">
        <div className="dlg-body">
          <h2 id="dlgTitle" />
          <p className="lede" id="dlgText" />
          <div id="dlgFields" />
          <div id="dlgPreview" />
        </div>
        <div className="dlg-foot">
          <button type="button" className="btn btn-sec" id="dlgCancel">Cancel</button>
          <button type="button" className="btn btn-pri" id="dlgOk" />
        </div>
      </dialog>

      <dialog id="palette" aria-label="Search">
        <div className="pal-in">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--ink-3)' }}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input id="palInput" placeholder="Order number, product, SKU, customer, phone or payment ID" aria-label="Search" autoComplete="off" />
        </div>
        <div className="pal-res" id="palRes" role="listbox" />
      </dialog>

      <dialog id="docDlg" aria-labelledby="docTitle">
        <div className="doc-dlg-head"><h2 id="docTitle" /></div>
        <div id="docBody" />
        <div className="dlg-foot">
          <button type="button" className="btn btn-sec" data-act="closeDoc">Close</button>
          <button type="button" className="btn btn-pri" data-act="printDoc">Print or save as PDF</button>
        </div>
      </dialog>

      <div className="toasts" id="toasts" aria-live="polite" />
    </>
  );
}

export default App;
