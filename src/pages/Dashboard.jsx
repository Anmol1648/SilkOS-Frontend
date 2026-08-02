import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { companies, me } from '../api/endpoints';
import { useAuth, useToast } from '../context/AppContext';
import { useConfig } from '../context/ConfigContext';
import { Skeleton, Tooltip } from '../components/ui';
import { Illo } from '../components/illos';
import { fmtDate } from '../lib/format';
import DashboardSidebar from '../components/DashboardSidebar';
import AddCompanyModal from '../components/AddCompanyModal';

/**
 * Dashboard — the landing page after login (PRD §4).
 *
 * Redesigned to use a sidebar layout matching Clarum's design pattern.
 * Companies are displayed as cards in a responsive grid.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { error: toastError } = useToast();
  const { brand } = useConfig();
  const [items, setItems] = useState(null);
  const [adding, setAdding] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);

  const load = () => me.contexts()
    .then((res) => setItems(res.items || []))
    .catch((e) => { toastError(e); setItems([]); });

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Group by company: one card per company, however many deals it has.
  const byCompany = new Map();
  for (const it of items || []) {
    const key = it.companyId || it.companyName;
    if (!key) continue;
    if (!byCompany.has(key)) {
      byCompany.set(key, {
        companyId: it.companyId,
        companyName: it.companyName || 'Untitled company',
        industry: it.industry || it.sector || '',
        logoUrl: it.logoUrl || '',
        stageNo: it.currentStageNo ?? it.stageNo,
        stageLabel: it.currentStageLabel || '',
        updatedAt: it.updatedAt || it.lastUpdatedAt,
        resumePath: it.resumePath,
        profileComplete: it.profileComplete,
        lastRaise: it.lastRaise,
        attachmentLinks: it.attachmentLinks,
        deals: [],
      });
    }
    const row = byCompany.get(key);
    
    if (it.scope === 'company') {
      if (it.industry || it.sector) row.industry = it.industry || it.sector;
      if (it.lastRaise !== undefined) row.lastRaise = it.lastRaise;
      if (it.attachmentLinks !== undefined) row.attachmentLinks = it.attachmentLinks;
      if (it.profileComplete !== undefined) row.profileComplete = it.profileComplete;
    }

    if (it.dealId && it.scope === 'deal') row.deals.push(it);
    if (it.updatedAt && (!row.updatedAt || it.updatedAt > row.updatedAt)) {
      row.updatedAt = it.updatedAt;
    }
  }
  const cards = [...byCompany.values()].sort((a, b) => {
    const d1 = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const d2 = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return d2 - d1;
  });
  const filteredCards = selectedCompanyId ? cards.filter(c => c.companyId === selectedCompanyId) : cards;

  return (
    <div className="ds-layout">
      <DashboardSidebar 
        activeItem="workspaces" 
        companies={cards.slice(0, 3)} 
        selectedCompanyId={selectedCompanyId} 
        onSelectCompany={setSelectedCompanyId} 
      />

      <div className="ds-main-area">
        {/* ---- Top header bar ---- */}
        <header className="ds-topbar">
          <div className="ds-topbar-left">
            <h1 className="ds-page-title">Companies</h1>
            <button className="ds-help-btn" aria-label="Help">
              Help
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
          </div>
          <div className="ds-topbar-right">
            <button className="ds-create-btn" onClick={() => setAdding(true)}>
              Create +
            </button>
          </div>
        </header>

        {/* ---- Add Company Modal (overlay) ---- */}
        {adding && (
          <AddCompanyModal
            onCancel={() => { setAdding(false); load(); }}
            onCreated={(companyId) => navigate(`/companies/${companyId}/profile`)}
          />
        )}

        {/* ---- Content ---- */}
        <div className="ds-content">

          {items === null && (
            <div className="ds-cards-grid">
              <Skeleton h={180} style={{ borderRadius: '12px' }} />
              <Skeleton h={180} style={{ borderRadius: '12px' }} />
              <Skeleton h={180} style={{ borderRadius: '12px' }} />
            </div>
          )}

          {items !== null && cards.length === 0 && (
            <div className="ds-empty-state">
              <span className="illo-wrap"><Illo name="handshake" size={110} /></span>
              <h2>Welcome to {brand.productName}</h2>
              <p className="hint" style={{ maxWidth: 460, margin: '0 auto 18px' }}>
                Add your company and {brand.productName} will build a complete company
                profile from your website, your documents and public sources — then help
                you plan the raise.
              </p>
              <button className="ds-create-btn" onClick={() => setAdding(true)}>
                Create +
              </button>
            </div>
          )}

          {cards.length > 0 && filteredCards.length > 0 && (
            <>
              <div className="ds-cards-count">{filteredCards.length} total</div>
              <div className="ds-cards-grid">
                {filteredCards.map((c) => (
                  <CompanyCard key={c.companyId || c.companyName} company={c} />
                ))}
              </div>
            </>
          )}
          
          {cards.length > 0 && filteredCards.length === 0 && (
            <div className="ds-empty-state">
              <h2>No matching companies found</h2>
              <p className="hint">Try clearing your filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/**
 * CompanyCard — styled like Clarum's workflow cards.
 * Clean white card with title, proper description, industry tags,
 * bottom row with document info + right-arrow navigate button.
 */
function CompanyCard({ company }) {
  const navigate = useNavigate();

  function open() {
    if (company.resumePath) { navigate(company.resumePath); return; }
    if (company.profileComplete && company.deals.length) {
      const stage = company.stageNo && company.stageNo > 0 ? company.stageNo : 1;
      navigate(`/deals/${company.deals[0].dealId}/stage/${stage}`);
      return;
    }
    navigate(`/companies/${company.companyId}/profile`);
  }

  // Build a natural description from available company data
  const descParts = [];
  if (company.industry) {
    descParts.push(`Operating in the ${company.industry} sector.`);
  }
  if (company.lastRaise && company.lastRaise.round) {
    let raiseText = `Last raised ${company.lastRaise.round}`;
    if (company.lastRaise.date) {
      // Use fmtDate for clean "Month Year" or similar (or just standard fmtDate which gives "8 Aug 2023")
      // To get "August 2023", you can do a custom format, but fmtDate is fine. Let's use it.
      raiseText += ` in ${fmtDate(company.lastRaise.date)}`;
    }
    descParts.push(raiseText + '.');
  } else if (company.deals.length > 0) {
    descParts.push(`Currently has ${company.deals.length} active fundraising round${company.deals.length !== 1 ? 's.' : '.'}`);
  }
  
  const description = descParts.length > 0
    ? descParts.join(' ')
    : `Company profile and fundraising workspace for ${company.companyName}.`;

  // Tags from industry keywords
  const tags = [];
  if (company.industry) {
    company.industry.split(/[,\/&]+/).forEach((t) => {
      const trimmed = t.trim();
      if (trimmed) tags.push(trimmed);
    });
  }

  // Document type label — show what they've uploaded if available
  const docLabel = company.deals.length > 0 ? 'Documents' : 'Profile';
  const links = company.attachmentLinks || {};
  const hasIcons = !!(links.companyUrl || links.founderProfile || links.productDeck || links.companyPresentation || links.financialModel || links.annualReportFinancialStatements || (links.other && links.other.length > 0) || (links.otherDocuments && links.otherDocuments.length > 0));

  return (
    <div className="ds-company-card" onClick={open} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') open(); }}>
      {/* Title */}
      <div className="ds-card-header">
        <h3 className="ds-card-title">{company.companyName}</h3>
      </div>

      {/* Description */}
      <Tooltip content={description}>
        <p className="ds-card-desc" style={{ cursor: 'default' }}>{description}</p>
      </Tooltip>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="ds-card-tags">
          {tags.slice(0, 3).map((tag) => (
            <span className="ds-tag" key={tag}>{tag}</span>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="ds-card-spacer" />

      {/* Bottom info row */}
      <div className="ds-card-bottom">
        <div className="ds-card-meta">
          {hasIcons ? (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {links.companyUrl && (
                <Tooltip content="Company Website" width={130}>
                  <a href={links.companyUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--muted)', display: 'flex', cursor: 'pointer', textDecoration: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  </a>
                </Tooltip>
              )}
              {links.founderProfile && (
                <Tooltip content="Founder LinkedIn" width={130}>
                  <a href={links.founderProfile} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--muted)', display: 'flex', cursor: 'pointer', textDecoration: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                  </a>
                </Tooltip>
              )}
              {(links.productDeck || links.companyPresentation) && (
                <Tooltip content="Product Deck" width={110}>
                  <a href={links.productDeck || links.companyPresentation} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--muted)', display: 'flex', cursor: 'pointer', textDecoration: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                  </a>
                </Tooltip>
              )}
              {links.financialModel && (
                <Tooltip content="Financial Model" width={120}>
                  <a href={links.financialModel} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--muted)', display: 'flex', cursor: 'pointer', textDecoration: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                  </a>
                </Tooltip>
              )}
              {links.annualReportFinancialStatements && (
                <Tooltip content="Annual Report" width={110}>
                  <a href={links.annualReportFinancialStatements} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--muted)', display: 'flex', cursor: 'pointer', textDecoration: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </a>
                </Tooltip>
              )}
              {(links.otherDocuments || links.other) && (links.otherDocuments || links.other).length > 0 && (
                <Tooltip content="Other Documents" width={130}>
                  <a href={(links.otherDocuments || links.other)[0]} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--muted)', display: 'flex', cursor: 'pointer', textDecoration: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/><line x1="8" y1="8" x2="10" y2="8"/></svg>
                  </a>
                </Tooltip>
              )}
            </div>
          ) : (
            <>
              <span className="ds-meta-dot" />
              <span className="ds-meta-type">{docLabel}</span>
            </>
          )}
          {company.updatedAt && (
            <>
              <svg className="ds-meta-clock" style={{ marginLeft: hasIcons ? '12px' : 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="ds-meta-time">
                {fmtDate(company.updatedAt)}
              </span>
            </>
          )}
        </div>
        <span className="ds-card-icon-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </div>
    </div>
  );
}

