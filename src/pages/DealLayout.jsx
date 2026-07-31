import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { DealProvider, useDeal } from '../context/DealContext';
import { useAuth, useToast } from '../context/AppContext';
import { useConfig } from '../context/ConfigContext';
import { me } from '../api/endpoints';
import { Ring } from '../components/ui';
import { fmtDate } from '../lib/format';

// Stage numbering and labels come from the admin-configured registry
// delivered by /config/app — never hard-coded here, so the two sides can
// no longer drift apart.

export default function DealLayout() {
  return (
    <DealProvider>
      <Shell />
    </DealProvider>
  );
}

function Shell() {
  const { dealId, masterplan, context } = useDeal();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { brand, stages: stageDefs, stageLabel } = useConfig();

  const [bellOpen, setBellOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    me.notifications().then((r) => setNotifs(r.items || [])).catch(() => {});
  }, [dealId, bellOpen]);
  const unread = notifs.filter((n) => !n.isRead).length;

  // Merge live completion from the masterplan onto the configured journey,
  // so the sidebar shows every stage even before any state row exists.
  const planByNo = new Map((masterplan?.stages || []).map((s) => [s.stageNo, s]));
  const journey = stageDefs.map((def) => ({
    ...def,
    completionPct: planByNo.get(def.stageNo)?.completionPct || 0,
    prerequisites: planByNo.get(def.stageNo)?.prerequisites || def.prerequisites || [],
  }));

  return (
    <div className="app-shell">
      <nav className="rail">
        <div className="wordmark">
          {(brand.logoMonoUrl || brand.logoUrl) && (
            <img src={brand.logoMonoUrl || brand.logoUrl}
                 alt={brand.productName} className="brand-logo" />
          )}
          <span className="wordmark-name">{brand.productName}</span>
          {brand.tagline && (
            <span className="wordmark-tagline">{brand.tagline}</span>
          )}
        </div>
        <button
          type="button"
          className="rail-link"
          style={{ background: 'none', border: 'none', width: '100%',
                   textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
          onClick={() => navigate('/dashboard')}
        >
          ⌂ All companies
        </button>
        <NavLink to={`/deals/${dealId}`} end className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}>
          ◇ Deal home
        </NavLink>
        <NavLink to={`/deals/${dealId}/ckb`} className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}>
          ▤ Knowledge base
        </NavLink>
        <NavLink to={`/deals/${dealId}/members`} className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}>
          ☰ Members
        </NavLink>

        <div className="rail-section">The journey</div>
        {journey.map((s) => {
          // C6 / PRD §2.4 — no stage is ever locked. Where prerequisites are
          // outstanding we show a status badge, never a padlock, and the
          // link stays clickable.
          const pending = (s.prerequisites || []).filter((p) => !p.met).length;
          const inner = (
            <>
              <Ring pct={s.completionPct || 0} />
              <span style={{ flex: 1 }}>{s.stageNo}. {s.label || stageLabel(s.stageNo)}</span>
              {pending > 0 && (
                <span className="pill pill-amber" title="Some inputs are still pending">
                  {pending}
                </span>
              )}
            </>
          );
          if (!s.isImplemented) {
            return (
              <span key={s.stageNo} className="rail-link upcoming"
                title="Coming in a later release">
                {inner}
              </span>
            );
          }
          return (
            <NavLink key={s.stageNo} to={`/deals/${dealId}/stage/${s.stageNo}`}
              className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}>
              {inner}
            </NavLink>
          );
        })}
      </nav>

      <div>
        <header className="topbar">
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/start')} title="Switch company / deal">
              ⇄ {context ? `${context.companyName} · ${context.dealName}` : 'Switch deal'}
            </button>
          </div>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => setBellOpen((o) => !o)} aria-label="Notifications">
              🔔{unread > 0 && <span className="pill pill-red" style={{ marginLeft: 4 }}>{unread}</span>}
            </button>
            <span className="row" style={{ gap: 7 }}>
              <span className="avatar">{(user?.displayName || user?.email || '?').slice(0, 1).toUpperCase()}</span>
              <span className="hint">{user?.displayName || user?.email}</span>
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
          </div>
        </header>

        {bellOpen && <NotifDrawer notifs={notifs} onRead={async (id) => {
          await me.markRead(id).catch(() => {});
          setNotifs((ns) => ns.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        }} onClose={() => setBellOpen(false)} />}

        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NotifDrawer({ notifs, onRead, onClose }) {
  return (
    <div className="card" style={{ position: 'absolute', right: 24, top: 58, width: 380, zIndex: 30, maxHeight: 420, overflowY: 'auto' }}>
      <div className="spread" style={{ marginBottom: 8 }}>
        <h3>Notifications</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>
      {notifs.length === 0 && <p className="hint">Nothing yet — generation results and approvals will appear here.</p>}
      {notifs.map((n) => (
        <div key={n.id} className="spread" style={{ padding: '9px 0', borderTop: '1px solid var(--line)' }}>
          <div>
            <div style={{ fontWeight: n.isRead ? 500 : 700 }}>{n.title || n.type}</div>
            <div className="hint">{n.body}</div>
            <div className="hint" style={{ fontSize: 11.5 }}>{fmtDate(n.createdAt)}</div>
          </div>
          {!n.isRead && <button className="btn btn-ghost btn-sm" onClick={() => onRead(n.id)}>Mark read</button>}
        </div>
      ))}
    </div>
  );
}
