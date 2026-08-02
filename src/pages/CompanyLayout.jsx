import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { profile as profileApi } from '../api/endpoints';
import DashboardSidebar from '../components/DashboardSidebar';

/**
 * Shell for company-scoped pages (Company Profile, Fundraising Strategy).
 *
 * C1 — a company is an independent entity: it may have no deal at all, and
 * may run several concurrent raises. The profile therefore lives here
 * rather than inside a deal workspace.
 *
 * Uses the same DashboardSidebar as the main dashboard for a consistent
 * navigation experience. The topbar shows only a company-switch button.
 */
export default function CompanyLayout() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { stages } = useConfig();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    profileApi.read(companyId)
      .then((res) => setCompany(res))
      .catch(() => setCompany(null));
  }, [companyId]);

  return (
    <div className="ds-layout">
      <DashboardSidebar activeItem="workspaces" companyId={companyId} company={company} stages={stages} />

      <div className="ds-main-area">
        {/* ---- Top header bar ---- */}
        <header className="ds-topbar">
          <div className="ds-topbar-left">
            <button
              className="ds-company-switch-btn"
              onClick={() => navigate('/dashboard')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {company?.companyName || 'Switch company'}
            </button>
          </div>
          <div className="ds-topbar-right" />
        </header>

        {/* ---- Page content ---- */}
        <div className="ds-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
