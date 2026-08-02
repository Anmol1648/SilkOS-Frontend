import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AppContext';
import { useConfig } from '../context/ConfigContext';

/**
 * DashboardSidebar — left rail for the dashboard, matching the Clarum
 * sidebar pattern: logo + brand at top, collapse/expand toggle, navigation
 * links, and a footer with support / settings / sign out / user info.
 */
export default function DashboardSidebar({ activeItem = 'workspaces', companyId, company, stages, companies, selectedCompanyId, onSelectCompany }) {
  const { user, logout } = useAuth();
  const { brand } = useConfig();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const userName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const userInitial = userName.slice(0, 1).toUpperCase();

  // Stage path resolver (used when companyId + stages are provided)
  function stagePath(stageNo, cId, comp) {
    if (stageNo === 1) return `/companies/${cId}/profile`;
    if (stageNo === 2) return `/companies/${cId}/strategy`;
    const dealId = comp?.defaultDealId;
    return dealId ? `/deals/${dealId}/stage/${stageNo}` : null;
  }

  return (
    <aside className={`ds-sidebar ${collapsed ? 'ds-collapsed' : ''}`}>
      {/* ---- Brand ---- */}
      <div className="ds-sidebar-top">
        <div className="ds-brand">
          <img
            src={brand.logoUrl || '/brand/silk-logo.svg'}
            alt={brand.productName}
            className="ds-brand-logo"
          />
          {/* {!collapsed && <span className="ds-brand-name">{brand.productName}</span>} */}
        </div>

        {/* Collapse / Expand toggle */}
        <button
          className="ds-icon-btn"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <path d="M9 3v18" />
              <path d="m14 9 3 3-3 3" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <path d="M9 3v18" />
              <path d="m16 15-3-3 3-3" />
            </svg>
          )}
        </button>
      </div>

      {/* ---- Workspace selector (dashboard only) ---- */}
      {!companyId && (
        <div className="ds-workspace-selector-wrapper" style={{ position: 'relative' }}>
          <div className="ds-workspace-selector" onClick={() => !collapsed && setDropdownOpen(!dropdownOpen)} style={{ cursor: 'pointer' }}>
            <div className="ds-ws-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            {!collapsed && (
              <>
                <span className="ds-ws-label" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedCompanyId && companies ? companies.find(c => c.companyId === selectedCompanyId)?.companyName || 'All' : 'All'}
                </span>
                <svg className="ds-ws-chevron" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </>
            )}
          </div>
          
          {dropdownOpen && !collapsed && (
            <div className="ds-workspace-dropdown" style={{ 
              position: 'absolute', top: '100%', left: 12, right: 12, marginTop: 4, 
              background: '#fff', border: '1px solid var(--line)', borderRadius: 8, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 250, overflowY: 'auto',
              padding: 4
            }}>
              <div 
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: !selectedCompanyId ? 'var(--ink)' : 'var(--muted)', fontWeight: !selectedCompanyId ? 500 : 400, background: !selectedCompanyId ? '#f3f4f6' : 'transparent', borderRadius: 4, marginBottom: 2 }}
                onClick={() => { onSelectCompany?.(null); setDropdownOpen(false); }}
              >
                All
              </div>
              {companies?.map(c => (
                <div 
                  key={c.companyId}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: selectedCompanyId === c.companyId ? 'var(--ink)' : 'var(--muted)', fontWeight: selectedCompanyId === c.companyId ? 500 : 400, background: selectedCompanyId === c.companyId ? '#f3f4f6' : 'transparent', borderRadius: 4, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  onClick={() => { onSelectCompany?.(c.companyId); setDropdownOpen(false); }}
                  title={c.companyName}
                >
                  {c.companyName}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Navigation (dashboard only) ---- */}
      {!companyId && (
        <nav className="ds-nav">
          <a
            href="#"
            className={`ds-nav-link ${activeItem === 'workspaces' ? 'active' : ''}`}
            onClick={(e) => e.preventDefault()}
            title="Companies"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            {!collapsed && 'Companies'}
          </a>
        </nav>
      )}

      {/* ---- Stage navigation (shown when inside a company) ---- */}
      {companyId && stages && stages.length > 0 && (
        <div className="ds-stages-section">
          {!collapsed && <div className="ds-stages-label">The journey</div>}
          <nav className="ds-nav">
            {stages.map((s) => {
              const path = stagePath(s.stageNo, companyId, company);
              const inner = (
                <>
                  <span className="ds-stage-dot">{s.stageNo}</span>
                  {!collapsed && <span>{s.label}</span>}
                </>
              );
              if (!s.isImplemented || !path) {
                return (
                  <span
                    key={s.stageNo}
                    className="ds-nav-link ds-stage-upcoming"
                    title="Coming in a later release"
                  >
                    {inner}
                  </span>
                );
              }
              return (
                <NavLink
                  key={s.stageNo}
                  to={path}
                  className={({ isActive }) => `ds-nav-link ${isActive ? 'active' : ''}`}
                >
                  {inner}
                </NavLink>
              );
            })}
          </nav>
        </div>
      )}

      {/* ---- Spacer ---- */}
      <div className="ds-nav-spacer" />

      {/* ---- Footer ---- */}
      <div className="ds-sidebar-footer">
        {/* <a href="#" className="ds-footer-link" onClick={(e) => e.preventDefault()} title="Support">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {!collapsed && 'Support'}
        </a> */}
        <a href="#" className="ds-footer-link" onClick={(e) => e.preventDefault()} title="Settings">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          {!collapsed && 'Settings'}
        </a>
        <a
          href="#"
          className="ds-footer-link"
          title="Sign out"
          onClick={(e) => { e.preventDefault(); logout(); navigate('/login'); }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {!collapsed && 'Sign out'}
        </a>

        {/* ---- User info ---- */}
        <div className="ds-user-block">
          <div className="ds-user-avatar">{userInitial}</div>
          {!collapsed && (
            <div className="ds-user-details">
              <span className="ds-user-name">{userName}</span>
              {user?.email && <span className="ds-user-role">{user.email}</span>}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
