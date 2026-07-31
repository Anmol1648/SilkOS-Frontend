import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AppContext';
import { useConfig } from '../context/ConfigContext';
import { profile as profileApi } from '../api/endpoints';

/**
 * Shell for company-scoped pages (Company Profile, Fundraising Strategy).
 *
 * C1 — a company is an independent entity: it may have no deal at all, and
 * may run several concurrent raises. The profile therefore lives here
 * rather than inside a deal workspace.
 *
 * PRD §2.4 — the journey is always visible and every stage is clickable.
 * No padlocks; pending prerequisites show as a badge instead.
 */
export default function CompanyLayout() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { brand, stages } = useConfig();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    profileApi.read(companyId)
      .then((res) => setCompany(res))
      .catch(() => setCompany(null));
  }, [companyId]);

  // Stage 1 and 2 are company-scoped; the rest still route through a deal.
  function stagePath(stageNo) {
    if (stageNo === 1) return `/companies/${companyId}/profile`;
    if (stageNo === 2) return `/companies/${companyId}/strategy`;
    const dealId = company?.defaultDealId;
    return dealId ? `/deals/${dealId}/stage/${stageNo}` : null;
  }

  return (
    <div className="app-shell">
      <nav className="rail">
        <div className="wordmark">
          {/* The rail is dark, so prefer the white/mono mark. The configured
              product name is ALWAYS shown as text beneath the logo — QA
              issue 6: an admin who changed the Product Name saw neither the
              new name (the logo image hid it) nor could they remove the
              hardcoded "guided fundraising" tagline (it was a CSS
              pseudo-element). Both now come from configuration. */}
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

        {/* Primary deal-scoped items are shown in BOTH the company and deal
            layouts so the sidebar's top section stays identical as the
            founder moves between Company Profile, Knowledge Base and Members
            (tester Issue #2 — the rail must not gain/lose items per page). */}
        {company?.defaultDealId && (
          <>
            <NavLink
              to={`/deals/${company.defaultDealId}/ckb`}
              className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}
            >
              ▤ Knowledge base
            </NavLink>
            <NavLink
              to={`/deals/${company.defaultDealId}/members`}
              className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}
            >
              ☰ Members
            </NavLink>
          </>
        )}

        <div className="rail-section">The journey</div>
        {stages.map((s) => {
          const path = stagePath(s.stageNo);
          const inner = (
            <>
              <span style={{ flex: 1 }}>{s.stageNo}. {s.label}</span>
            </>
          );
          if (!s.isImplemented || !path) {
            return (
              <span key={s.stageNo} className="rail-link upcoming"
                title="Coming in a later release">
                {inner}
              </span>
            );
          }
          return (
            <NavLink key={s.stageNo} to={path}
              className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}>
              {inner}
            </NavLink>
          );
        })}
      </nav>

      <div>
        <header className="topbar">
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>
              ⇄ {company?.companyName || 'Switch company'}
            </button>
          </div>
          <div className="row">
            <span className="row" style={{ gap: 7 }}>
              <span className="avatar">
                {(user?.displayName || user?.email || '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="hint">{user?.displayName || user?.email}</span>
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { logout(); navigate('/login'); }}
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
