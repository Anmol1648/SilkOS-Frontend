import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { profile as profileApi, companies } from '../../api/endpoints';
import { useToast, useConfirm } from '../../context/AppContext';
import { useConfig } from '../../context/ConfigContext';
import { AiBadge, Pill, SkeletonCard } from '../../components/ui';
import { fmtDate } from '../../lib/format';
import OnboardingForm from './OnboardingForm';

/**
 * Company Profile — one page, every section editable (PRD §5.4).
 *
 * Replaces the old Investor Readiness wizard. Sections are driven by the
 * admin-configured registry rather than hard-coded here, so adding or
 * reordering a section is a configuration change, not a release.
 *
 * Each section behaves identically: Edit, Save, Regenerate, History. That
 * uniformity is deliberate — sixteen bespoke implementations would be
 * unmaintainable.
 */
function CompanyOverviewViewer({ data }) {
  const iconStyle = { width: 16, height: 16, color: 'var(--ink)' };

  const icons = {
    website: <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
    country: <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
    macro_sector: <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" /></svg>,
    sub_sector: <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>,
    funding_status_name: <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10" /><path d="M17 4v8a5 5 0 0 1-10 0V4" /><path d="M7 6H3v3a5 5 0 0 0 5 5h1" /><path d="M17 6h4v3a5 5 0 0 1-5 5h-1" /></svg>,
    employee_strength_name: <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    revenue_size_name: <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
    currency_id: <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="18" y2="3" /><line x1="6" y1="8" x2="18" y2="8" /><path d="M14.5 3a5.5 5.5 0 0 1-1 11H6" /><path d="M6 14l8 8" /></svg>,
  };

  const { description_of_business, ...restFields } = data;
  const entries = Object.entries(restFields);

  const renderField = (k, v) => {
    const icon = icons[k] || <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
    return (
      <div key={k} className="cp-overview-field">
        <div className="cp-overview-icon-box">{icon}</div>
        <div className="cp-overview-field-content">
          <span className="cp-overview-label">{k.replace(/_/g, ' ')}</span>
          <span className="cp-overview-value">
            {k === 'website' && v && typeof v === 'string' ? (
              <a href={v.startsWith('http') ? v : `https://${v}`} target="_blank" rel="noopener noreferrer" className="cp-overview-link">
                {v.replace(/^https?:\/\//, '')}
              </a>
            ) : (
              Array.isArray(v) ? v.join(', ') : (v || <span className="cp-empty-field">N/A</span>)
            )}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="cp-overview-card">
      {description_of_business && (
        <div className="cp-overview-desc-container">
          <div className="cp-overview-desc-accent"></div>
          <div className="cp-overview-desc">
            <div className="cp-overview-label">Description of business</div>
            <p className="cp-overview-desc-text">{description_of_business}</p>
          </div>
        </div>
      )}

      {description_of_business && entries.length > 0 && <hr className="cp-overview-hr" />}

      {entries.length > 0 && (
        <div className="cp-overview-grid-container">
          <div className="cp-overview-grid">
            {entries.slice(0, 4).map(([k, v]) => renderField(k, v))}
          </div>
          {entries.length > 4 && <hr className="cp-overview-hr" />}
          {entries.length > 4 && (
            <div className="cp-overview-grid">
              {entries.slice(4).map(([k, v]) => renderField(k, v))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FoundersViewer({ data }) {
  if (!data) return null;
  const dataArray = Array.isArray(data) ? data : [data];
  if (dataArray.length === 0) return null;

  const iconStyle = { width: 16, height: 16, color: 'var(--ink)' };

  const getIcon = (key) => {
    const k = key.toLowerCase();
    if (k.includes('name')) return <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    if (k.includes('role') || k.includes('designation')) return <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M16 16s-1.5-2-4-2-4 2-4 2" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>;
    if (k.includes('background') || k.includes('experience')) return <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>;
    if (k.includes('linkedin')) return <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>;
    if (k.includes('time') || k.includes('active')) return <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
    if (k.includes('product') || k.includes('service') || k.includes('item')) return <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>;
    if (k.includes('description') || k.includes('details')) return <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;
    if (k.includes('customer') || k.includes('market') || k.includes('region') || k.includes('geography') || k.includes('location')) return <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;
    if (k.includes('advantage') || k.includes('strength') || k.includes('competitor') || k === 'title') return <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>;
    if (k.includes('model') || k.includes('pricing') || k.includes('sales')) return <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>;
    return <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
  };

  const renderField = (k, v, numKeys) => {
    const isLong = k.toLowerCase() === 'background' || k.toLowerCase() === 'biography' || (typeof v === 'string' && v.length > 60);
    return (
      <div key={k} className="cp-overview-field" style={{ gridColumn: numKeys <= 2 ? 'auto' : (isLong ? 'span 2' : 'span 1') }}>
        <div className="cp-overview-icon-box">{getIcon(k)}</div>
        <div className="cp-overview-field-content">
          <span className="cp-overview-label">{k.replace(/_/g, ' ')}</span>
          <span className="cp-overview-value">
            {k.toLowerCase().includes('linkedin') && v && typeof v === 'string' ? (
              <a href={v.startsWith('http') ? v : `https://${v}`} target="_blank" rel="noopener noreferrer" className="cp-overview-link">
                {v.replace(/^https?:\/\//, '')}
              </a>
            ) : Array.isArray(v) ? (
              <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {v.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            ) : (
              v === true ? 'Yes' : v === false ? 'No' : (v || <span className="cp-empty-field">N/A</span>)
            )}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {dataArray.map((founder, idx) => {
        const numKeys = Object.keys(founder).length;
        return (
          <div key={idx} className="cp-overview-card" style={{ padding: '24px', background: '#fff', border: '1px solid var(--line)', borderRadius: '12px' }}>
            <div className="cp-overview-grid-container">
              <div className="cp-overview-grid" style={{ gridTemplateColumns: numKeys <= 2 ? '1fr 2fr' : undefined }}>
                {Object.entries(founder).map(([k, v]) => renderField(k, v, numKeys))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RevenueModelViewer({ data }) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  // Premium, modern color palette
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1'];

  // Normalize in case total isn't exactly 100
  const total = data.reduce((sum, item) => sum + (Number(item.share_percent || item.SharePercent || 0)), 0);

  return (
    <div style={{ padding: '24px', background: '#fff', border: '1px solid var(--line)', borderRadius: '12px' }}>

      {/* Stacked Progress Bar */}
      <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '24px', backgroundColor: '#f3f4f6' }}>
        {data.map((item, idx) => {
          const val = Number(item.share_percent || item.SharePercent || 0);
          const width = total > 0 ? (val / total) * 100 : 0;
          return (
            <div
              key={idx}
              style={{
                width: `${width}%`,
                backgroundColor: colors[idx % colors.length],
                transition: 'width 0.3s ease'
              }}
              title={`${item.stream}: ${val}%`}
            />
          );
        })}
      </div>

      {/* Legend Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {data.map((item, idx) => {
          const val = Number(item.share_percent || item.SharePercent || 0);
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: colors[idx % colors.length], flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.2, marginBottom: '2px' }}>{item.stream || 'Unknown Stream'}</span>
                <span style={{ fontSize: '16px', color: 'var(--ink)', fontWeight: 600 }}>{val}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompanyMetricsViewer({ data }) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
      {data.map((item, idx) => (
        <div key={idx} className="cp-overview-card" style={{ padding: '24px', background: '#fff', border: '1px solid var(--line)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
            <span style={{ fontSize: '36px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1 }}>{item.value}</span>
            {item.unit && item.unit !== '#' && (
              <span style={{ fontSize: '16px', color: 'var(--muted)', fontWeight: 600 }}>{item.unit}</span>
            )}
          </div>
          <span style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>
            {item.metric}
          </span>
        </div>
      ))}
    </div>
  );
}

function FundingHistoryViewer({ data }) {
  const [viewMode, setViewMode] = useState('card');

  if (!data || !Array.isArray(data) || data.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', background: '#f3f4f6', padding: 4, borderRadius: 8, gap: 4 }}>
          <button
            onClick={() => setViewMode('card')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              background: viewMode === 'card' ? '#fff' : 'transparent',
              color: viewMode === 'card' ? 'var(--ink)' : 'var(--muted)',
              border: 'none',
              boxShadow: viewMode === 'card' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Card
          </button>
          <button
            onClick={() => setViewMode('table')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              background: viewMode === 'table' ? '#fff' : 'transparent',
              color: viewMode === 'table' ? 'var(--ink)' : 'var(--muted)',
              border: 'none',
              boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Table
          </button>
        </div>
      </div>

      {viewMode === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {data.map((row, idx) => (
            <div key={idx} style={{ background: '#f6f5f2', padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 500, color: 'var(--ink)' }}>
                {row.round || 'Unknown Round'}
              </h3>
              
              <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</span>
                  <span style={{ fontSize: '22px', fontWeight: 500, color: 'var(--ink)' }}>{row.date || '—'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Funds</span>
                  <span style={{ fontSize: '22px', fontWeight: 500, color: 'var(--ink)' }}>
                    {row.amount_usd_mn ? `$${row.amount_usd_mn} Mn` : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
                  <span style={{ fontSize: '22px', fontWeight: 500, color: 'var(--ink)' }}>{row.status || '—'}</span>
                </div>
              </div>
              
              {row.investors && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(Array.isArray(row.investors) ? row.investors : row.investors.split(',')).map((inv, i) => (
                    <span key={i} style={{ background: '#fff', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                      {inv.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', borderRadius: '8px 0 0 8px' }}>Date</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Round</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Funds Raised</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Status</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', borderRadius: '0 8px 8px 0' }}>Investors</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '16px', fontSize: 14, color: 'var(--ink)' }}>{row.date || '—'}</td>
                  <td style={{ padding: '16px', fontSize: 14, color: 'var(--ink)' }}>{row.round || '—'}</td>
                  <td style={{ padding: '16px', fontSize: 14, color: 'var(--ink)' }}>
                    {row.amount_usd_mn ? `USD ${row.amount_usd_mn} Mn` : '—'}
                  </td>
                  <td style={{ padding: '16px', fontSize: 14, color: 'var(--ink)' }}>{row.status || '—'}</td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Array.isArray(row.investors)
                        ? row.investors.map((inv, i) => (
                            <span key={i} style={{ padding: '4px 10px', background: '#f3f4f6', borderRadius: 100, fontSize: 12, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                              {inv}
                            </span>
                          ))
                        : row.investors ? (
                            <span style={{ padding: '4px 10px', background: '#f3f4f6', borderRadius: 100, fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>
                              {row.investors}
                            </span>
                        ) : '—'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FinancialSummaryViewer({ data }) {
  const [viewMode, setViewMode] = useState('card');

  if (!data || !data.financials || !Array.isArray(data.financials)) return null;

  const financials = data.financials;
  const observations = Array.isArray(data.observations) ? data.observations : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', background: '#f3f4f6', padding: 4, borderRadius: 8, gap: 4 }}>
          <button
            onClick={() => setViewMode('card')}
            style={{ padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500, background: viewMode === 'card' ? '#fff' : 'transparent', color: viewMode === 'card' ? 'var(--ink)' : 'var(--muted)', border: 'none', boxShadow: viewMode === 'card' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Card
          </button>
          <button
            onClick={() => setViewMode('table')}
            style={{ padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500, background: viewMode === 'table' ? '#fff' : 'transparent', color: viewMode === 'table' ? 'var(--ink)' : 'var(--muted)', border: 'none', boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Table
          </button>
        </div>
      </div>

      {viewMode === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {financials.map((row, idx) => (
            <div key={idx} style={{ background: '#f6f5f2', padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 500, color: 'var(--ink)' }}>
                {row.year ? `FY ${row.year}` : 'Unknown Year'}
              </h3>
              
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Revenue</span>
                  <span style={{ fontSize: '22px', fontWeight: 500, color: 'var(--ink)' }}>
                    {row.revenue_m ? `$${row.revenue_m} Mn` : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EBITDA</span>
                  <span style={{ fontSize: '22px', fontWeight: 500, color: 'var(--ink)' }}>
                    {row.ebitda_m ? `$${row.ebitda_m} Mn` : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Growth</span>
                  <span style={{ fontSize: '22px', fontWeight: 500, color: 'var(--ink)' }}>
                    {row.growth_pct ? `${row.growth_pct}%` : '—'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', borderRadius: '8px 0 0 8px' }}>Year</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Revenue</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>EBITDA</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', borderRadius: '0 8px 8px 0' }}>Growth</th>
              </tr>
            </thead>
            <tbody>
              {financials.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '16px', fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{row.year || '—'}</td>
                  <td style={{ padding: '16px', fontSize: 14, color: 'var(--ink)' }}>{row.revenue_m ? `$${row.revenue_m} Mn` : '—'}</td>
                  <td style={{ padding: '16px', fontSize: 14, color: 'var(--ink)' }}>{row.ebitda_m ? `$${row.ebitda_m} Mn` : '—'}</td>
                  <td style={{ padding: '16px', fontSize: 14, color: 'var(--ink)' }}>{row.growth_pct ? `${row.growth_pct}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {observations.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>Observations</h4>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {observations.map((obs, i) => (
              <li key={i} style={{ marginBottom: 8, color: 'var(--ink)', fontSize: '14px' }}>
                {typeof obs === 'string' ? obs : obs.title || obs.description || ''}
                {typeof obs === 'object' && obs.title && obs.description && (
                  <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{obs.description}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CompetitorsViewer({ data }) {
  const [viewMode, setViewMode] = useState('card');

  if (!data || !Array.isArray(data) || data.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', background: '#f3f4f6', padding: 4, borderRadius: 8, gap: 4 }}>
          <button
            onClick={() => setViewMode('card')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              background: viewMode === 'card' ? '#fff' : 'transparent',
              color: viewMode === 'card' ? 'var(--ink)' : 'var(--muted)',
              border: 'none',
              boxShadow: viewMode === 'card' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Card
          </button>
          <button
            onClick={() => setViewMode('table')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              background: viewMode === 'table' ? '#fff' : 'transparent',
              color: viewMode === 'table' ? 'var(--ink)' : 'var(--muted)',
              border: 'none',
              boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Table
          </button>
        </div>
      </div>

      {viewMode === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {data.map((row, idx) => (
            <div key={idx} style={{ background: '#f6f5f2', padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 500, color: 'var(--ink)' }}>
                {row.name || 'Unknown Competitor'}
              </h3>
              
              <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>FY Year</span>
                  <span style={{ fontSize: '22px', fontWeight: 500, color: 'var(--ink)' }}>
                    {row.fy_year || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Revenue</span>
                  <span style={{ fontSize: '22px', fontWeight: 500, color: 'var(--ink)' }}>
                    {row.revenue ? (String(row.revenue).includes('$') ? row.revenue : `$${row.revenue}`) : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Funds</span>
                  <span style={{ fontSize: '22px', fontWeight: 500, color: 'var(--ink)' }}>
                    {row.funding_usd_mn && row.funding_usd_mn !== 'N/A' ? `$${row.funding_usd_mn} Mn` : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
                  <span style={{ fontSize: '22px', fontWeight: 500, color: 'var(--ink)' }}>{row.status || '—'}</span>
                </div>
              </div>
              
              {row.investors && row.investors !== 'N/A' && row.investors !== 'None' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(Array.isArray(row.investors) ? row.investors : row.investors.split(',')).map((inv, i) => (
                    <span key={i} style={{ background: '#fff', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                      {inv.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', borderRadius: '8px 0 0 8px' }}>Competitor</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>FY Year</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Revenue</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Funds</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Status</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', borderRadius: '0 8px 8px 0' }}>Investors</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '16px', fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{row.name || '—'}</td>
                  <td style={{ padding: '16px', fontSize: 14, color: 'var(--ink)' }}>
                    {row.fy_year || '—'}
                  </td>
                  <td style={{ padding: '16px', fontSize: 14, color: 'var(--ink)' }}>
                    {row.revenue ? (String(row.revenue).includes('$') ? row.revenue : `$${row.revenue}`) : '—'}
                  </td>
                  <td style={{ padding: '16px', fontSize: 14, color: 'var(--ink)' }}>
                    {row.funding_usd_mn && row.funding_usd_mn !== 'N/A' ? `$${row.funding_usd_mn} Mn` : '—'}
                  </td>
                  <td style={{ padding: '16px', fontSize: 14, color: 'var(--ink)' }}>{row.status || '—'}</td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Array.isArray(row.investors)
                        ? row.investors.map((inv, i) => (
                            <span key={i} style={{ padding: '4px 10px', background: '#f3f4f6', borderRadius: 100, fontSize: 12, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                              {inv}
                            </span>
                          ))
                        : row.investors ? (
                            <span style={{ padding: '4px 10px', background: '#f3f4f6', borderRadius: 100, fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>
                              {row.investors}
                            </span>
                        ) : '—'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecentNewsViewer({ data }) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {data.map((news, idx) => (
        <div key={idx} style={{ background: '#f6f5f2', padding: '24px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 500, color: 'var(--ink)' }}>
              {news.title || news.headline || 'Untitled'}
            </h3>
            {(news.source || news.date) && (
              <div style={{ fontSize: '14px', color: 'var(--muted)', whiteSpace: 'nowrap', marginLeft: '16px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                {news.source && <span style={{ fontWeight: 500 }}>{news.source}</span>}
                {news.source && news.date && <span>•</span>}
                {news.date && <span>{news.date}</span>}
              </div>
            )}
          </div>
          {news.description && (
            <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--ink)', lineHeight: 1.5 }}>
              {news.description}
            </p>
          )}
          {news.link && (
            <a href={news.link} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
              Read more →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function formatAISummary(text) {
  if (!text) return null;
  if (text.includes('\n')) {
    return text.split('\n').filter(p => p.trim()).map((p, i, arr) => (
      <p key={i} style={{ margin: i === arr.length - 1 ? 0 : '0 0 16px 0', lineHeight: 1.7 }}>{p}</p>
    ));
  }
  
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const paragraphs = [];
  let currentParagraph = [];
  
  for (let i = 0; i < sentences.length; i++) {
    currentParagraph.push(sentences[i].trim());
    if (currentParagraph.length >= 3 || i === sentences.length - 1) {
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph = [];
    }
  }
  
  return paragraphs.map((p, i) => (
    <p key={i} style={{ margin: i === paragraphs.length - 1 ? 0 : '0 0 16px 0', lineHeight: 1.7 }}>{p}</p>
  ));
}

function AICompanySummaryViewer({ data }) {
  if (!data || !data.summary) return null;

  return (
    <div style={{ background: '#f6f5f2', padding: '32px', borderRadius: '16px' }}>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <div style={{ 
          color: 'var(--primary)', 
          background: 'rgba(59, 130, 246, 0.1)', 
          padding: '12px', 
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.05)'
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
          </svg>
        </div>
        <div style={{ fontSize: '15px', color: 'var(--ink)' }}>
          {formatAISummary(data.summary)}
        </div>
      </div>
    </div>
  );
}

function LogoUploader({ companyId, logoUrl, companyName, websiteUrl, onUpdated }) {
  const { error: toastError, toast } = useToast();
  const [localUrl, setLocalUrl] = useState(logoUrl);
  const [hover, setHover] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptUrl, setPromptUrl] = useState('');

  useEffect(() => { setLocalUrl(logoUrl); }, [logoUrl]);

  useEffect(() => {
    if (showPrompt) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showPrompt]);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target.result;
      setLocalUrl(b64);
      try {
        await companies.updateLogo(companyId, { logoBase64: b64 });
        toast('Company logo updated.');
        if (onUpdated) onUpdated();
      } catch (err) {
        toastError(err);
        setLocalUrl(logoUrl);
      }
    };
    reader.readAsDataURL(file);
  }

  const openPrompt = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPromptUrl(websiteUrl ? websiteUrl.replace(/^https?:\/\//, '').split('/')[0] : '');
    setShowPrompt(true);
    setHover(false);
  };

  const submitPrompt = async (e) => {
    e.preventDefault();
    setShowPrompt(false);
    const domain = promptUrl.trim().replace(/^https?:\/\//, '').split('/')[0];
    if (!domain || !domain.includes('.')) {
      toastError(new Error("Invalid domain name."));
      return;
    }
    const url = `https://img.logo.dev/${domain}?token=pk_EsMpGCHZTke3dtHjuBheHA`;
    setLocalUrl(url);
    try {
      await companies.updateLogo(companyId, { logoUrl: url });
      toast('Company logo updated from website.');
      if (onUpdated) onUpdated();
    } catch (err) {
      toastError(err);
      setLocalUrl(logoUrl);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }} 
           onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div 
        style={{ 
          width: 48, height: 48, borderRadius: '8px', border: hover ? '1.5px dashed var(--mint)' : '1px solid var(--line)', 
          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--paper)', position: 'relative', transition: 'border-color 0.2s'
        }}
      >
        {localUrl ? (
          <>
            <img 
              src={localUrl} 
              alt="" 
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }} 
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div 
              style={{ 
                width: '100%', height: '100%',
                display: 'none', alignItems: 'center', justifyContent: 'center',
                background: 'var(--blue-050)', color: 'var(--blue-600)', fontSize: '20px', fontWeight: 600,
                textTransform: 'uppercase'
              }}
            >
              {companyName ? companyName.charAt(0) : '?'}
            </div>
          </>
        ) : (
          <div 
            style={{ 
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--blue-050)', color: 'var(--blue-600)', fontSize: '20px', fontWeight: 600,
              textTransform: 'uppercase'
            }}
          >
            {companyName ? companyName.charAt(0) : '?'}
          </div>
        )}
        {hover && !showPrompt && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-evenly' }}>
            <label title="Upload File" style={{ cursor: 'pointer', padding: 4, display: 'flex' }}>
              <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} onClick={(e) => e.stopPropagation()} />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </label>
            <div title="Auto-fetch from Website" style={{ cursor: 'pointer', padding: 4, display: 'flex' }} onClick={openPrompt}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
            </div>
          </div>
        )}
      </div>

      {/* Custom Modal */}
      {showPrompt && createPortal(
        <div 
          onClick={(e) => { e.stopPropagation(); setShowPrompt(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'default' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--card)', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: 'var(--shadow-2)' }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '8px', color: 'var(--ink)', fontSize: '18px' }}>Fetch Logo</h3>
            <p style={{ color: 'var(--muted)', fontSize: '14.5px', marginBottom: '24px', lineHeight: 1.5 }}>
              Enter the company website domain to auto-fetch the logo.
            </p>
            <form onSubmit={submitPrompt}>
              <input 
                type="text" 
                className="input-light" 
                autoFocus
                value={promptUrl}
                onChange={e => setPromptUrl(e.target.value)}
                placeholder="acme.com"
                style={{ width: '100%', marginBottom: '24px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ borderRadius: '999px', padding: '8px 16px' }} onClick={() => setShowPrompt(false)}>Cancel</button>
                <button type="submit" className="btn btn-dark" style={{ borderRadius: '999px', padding: '8px 16px' }}>Fetch Logo</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function CompanyProfile() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { toast, error: toastError } = useToast();
  const { copy } = useConfig();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const load = async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await profileApi.read(companyId);
      setData(res);
      return res;
    } catch (e) {
      toastError(e);
      return null;
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // While generation runs, refresh so sections appear as they complete.
  useEffect(() => {
    if (data?.status !== 'generating') { setPolling(false); return undefined; }
    setPolling(true);
    const t = setInterval(async () => {
      const res = await load({ silent: true });
      if (res && res.status !== 'generating') setPolling(false);
    }, 3000);
    return () => clearInterval(t);
  }, [data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const SECTION_LABELS = {
    company_profile: 'Company Overview',
    founders: 'Founders',
    key_people: 'Key People',
    products_services: 'Products & Services',
    customers_markets: 'Customers & Markets',
    competitive_advantages: 'Competitive Advantages',
    business_model: 'Business Model',
    revenue_model: 'Revenue Model',
    company_metrics: 'Company Metrics',
    financial_summary: 'Financial Summary',
    funding_history: 'Funding History',
    competitors: 'Competitors',
    recent_news: 'Recent News',
    ai_company_summary: 'AI Company Summary',
  };

  const SECTION_ORDER = Object.keys(SECTION_LABELS);

  const sections = useMemo(() => {
    if (!data) return [];
    const sectionsObj = data.sections || {};

    return SECTION_ORDER
      .filter(key => sectionsObj[key]) // only show sections the API sent
      .map(key => {
        const sec = sectionsObj[key];
        return {
          sectionKey: key,
          label: SECTION_LABELS[key],
          isComplete: sec.isComplete || false,
          lastUpdatedAt: sec.lastUpdatedAt,
          data: sec.data || null,
          isEditable: true,
        };
      });
  }, [data]);

  const needsOnboarding = data && data.status === 'draft' && !data.lastGeneratedAt;

  if (loading && !data) return <SkeletonCard />;

  if (needsOnboarding) {
    return (
      <>
        <div className="eyebrow">Stage 1 · Company Profile</div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
          <LogoUploader 
            companyId={companyId} 
            logoUrl={data.logoUrl} 
            companyName={data.companyName} 
            websiteUrl={data.websiteUrl}
            onUpdated={() => load({ silent: true })} 
          />
          <h1 style={{ margin: 0 }}>{data.companyName}</h1>
        </div>
        <OnboardingForm
          companyId={companyId}
          dealId={data.defaultDealId}
          onSubmitted={() => load({ silent: true })}
        />
      </>
    );
  }

  return (
    <>
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="eyebrow">Stage 1 · Company Profile</div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: 4 }}>
            <LogoUploader 
              companyId={companyId} 
              logoUrl={data.logoUrl} 
              companyName={data.companyName} 
              websiteUrl={data.websiteUrl}
              onUpdated={() => load({ silent: true })} 
            />
            <h1 style={{ margin: 0 }}>{data.companyName}</h1>
          </div>
          <p className="hint">
            {data.websiteUrl}
            {data.lastGeneratedAt && ` · generated ${fmtDate(data.lastGeneratedAt)}`}
          </p>
        </div>
        <ProfileStatus data={data} companyId={companyId} onChange={load} />
      </div>

      {data.status === 'generating' && (
        <div className="card generating-banner">
          <span className="spin" />
          <span>{copy('profile.generating',
            'Building your company profile from your website, your documents and public sources.')}</span>
        </div>
      )}

      {data.aiMocked && (
        <div className="card mock-banner">
          <strong>AI is in mock mode.</strong>{' '}
          {copy('profile.ai_mocked',
            'Generated sections show placeholder “[MOCK]” content, not real AI output. An administrator can connect a live model under Admin → LLM Integration to produce real content.')}
        </div>
      )}

      <div className="profile-layout">
        <nav className="profile-nav" aria-label="Profile sections">
          {sections.map((s) => (
            <a key={s.sectionKey} href={`#sec-${s.sectionKey}`} className="profile-nav-link">
              <span>{s.label}</span>
              {s.needsInput && <span className="dot-warn" title="Needs your input" />}
            </a>
          ))}
        </nav>

        <div className="profile-body">
          {sections.map((s) => (
            <Section
              key={s.sectionKey}
              companyId={companyId}
              section={s}
              profileData={data}
              onChanged={() => load({ silent: true })}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function ProfileStatus({ data }) {
  const pct = Math.round(data.completenessPct || 0);
  const r = 90;
  const cx = 130;
  const cy = 110;
  const arcLen = Math.PI * r;
  const fillLen = (pct / 100) * arcLen;

  return (
    <div style={{ textAlign: 'center', width: 260 }}>
      <div className="eyebrow" style={{ marginBottom: 16 }}>Completeness</div>
      <div style={{ position: 'relative', width: 260, height: 130, margin: '0 auto' }}>
        <svg viewBox="0 0 260 130" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F87171" />
              <stop offset="50%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#4ADE80" />
            </linearGradient>
            <mask id="gaugeMask">
              <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none"
                stroke="white"
                strokeWidth="24"
                strokeDasharray={`${fillLen} ${arcLen}`}
                style={{ transition: 'stroke-dasharray 1s ease-out' }}
              />
            </mask>
          </defs>
          {/* Background segmented arc */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="14"
            strokeDasharray="4 3"
          />
          {/* Foreground gradient segmented arc */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth="14"
            strokeDasharray="4 3"
            mask="url(#gaugeMask)"
          />
          <text x={cx - r - 10} y={cy + 15} fontSize="11" fill="#9CA3AF" textAnchor="end">0</text>
          <text x={cx + r + 10} y={cy + 15} fontSize="11" fill="#9CA3AF" textAnchor="start">100</text>
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, textAlign: 'center', transform: 'translateY(-35%)' }}>
          <span style={{ fontSize: 42, color: '#333' }}>
            {pct}<span style={{ fontSize: 24, marginLeft: 2 }}>%</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function CollapsibleWrapper({ id, title, icon, actions, needsInput, children }) {
  const [open, setOpen] = useState(true);

  return (
    <section className={`cp-collapsible profile-section ${open ? 'open' : ''}`} id={id}>
      <div className="cp-collapsible-header" onClick={() => setOpen(!open)}>
        <div className="cp-collapsible-title">
          {icon && <span className="cp-collapsible-icon">{icon}</span>}
          {title}
          {needsInput && <span className="dot-warn" title="Needs your input" />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {actions && <div className="cp-collapsible-actions" onClick={e => e.stopPropagation()}>{actions}</div>}
          <svg className="cp-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
      {open && (
        <div className="cp-collapsible-content">
          {children}
        </div>
      )}
    </section>
  );
}

/** One section. Uniform behaviour across all of them. */
function Section({ companyId, section, profileData, onChanged }) {
  const { toast, error: toastError } = useToast();
  const [editing, setEditing] = useState(false);
  const [draftData, setDraftData] = useState(section.data);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDraftData(section.data); }, [section.data]);

  const hasStructuredData = section.data && (
    (Array.isArray(section.data) && section.data.length > 0) ||
    (!Array.isArray(section.data) && typeof section.data === 'object' && Object.keys(section.data).length > 0)
  );

  async function save() {
    setBusy(true);
    try {
      await profileApi.saveSection(companyId, section.sectionKey, { data: draftData });
      toast(`${section.label} saved.`);
      setEditing(false);
      await onChanged();
    } catch (e) { toastError(e); }
    finally { setBusy(false); }
  }

  const companyIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
      <path d="M9 22v-4h6v4"></path>
      <path d="M8 6h.01"></path>
      <path d="M16 6h.01"></path>
      <path d="M12 6h.01"></path>
      <path d="M12 10h.01"></path>
      <path d="M12 14h.01"></path>
      <path d="M16 10h.01"></path>
      <path d="M16 14h.01"></path>
      <path d="M8 10h.01"></path>
      <path d="M8 14h.01"></path>
    </svg>
  );

  const foundersIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );

  const productsIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  );

  const customersIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  );

  const advantagesIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
  );

  const businessIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
    </svg>
  );

  const revenueIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
      <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
    </svg>
  );

  const metricsIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  );

  const fundingIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  );

  const competitorsIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
  );

  const newsIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path>
      <path d="M18 14h-8"></path>
      <path d="M15 18h-5"></path>
      <path d="M10 6h8v4h-8V6Z"></path>
    </svg>
  );

  const aiIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
    </svg>
  );

  return (
    <CollapsibleWrapper
      id={`sec-${section.sectionKey}`}
      title={section.label}
      needsInput={false}
      icon={
        section.sectionKey === 'company_profile' ? companyIcon :
          (section.sectionKey === 'founders' || section.sectionKey === 'key_people') ? foundersIcon :
            section.sectionKey === 'products_services' ? productsIcon :
              section.sectionKey === 'customers_markets' ? customersIcon :
                section.sectionKey === 'competitive_advantages' ? advantagesIcon :
                  section.sectionKey === 'business_model' ? businessIcon :
                    section.sectionKey === 'revenue_model' ? revenueIcon :
                      section.sectionKey === 'company_metrics' ? metricsIcon :
                        section.sectionKey === 'funding_history' ? fundingIcon :
                          section.sectionKey === 'competitors' ? competitorsIcon :
                            section.sectionKey === 'recent_news' || section.sectionKey === 'news' ? newsIcon :
                              section.sectionKey === 'ai_company_summary' ? aiIcon :
                                null
      }
      actions={!editing ? (
        <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setEditing(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          Edit
        </button>
      ) : null}
    >
      {editing ? (
        <>
          <div style={{ marginBottom: 16 }}>
            <DataViewer data={draftData} sectionKey={section.sectionKey} editing={true} onChange={setDraftData} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: '12px' }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ padding: '8px 16px', borderRadius: '6px' }}
              onClick={() => { setDraftData(section.data); setEditing(false); }}
            >
              Cancel
            </button>
            <button className="btn btn-dark btn-sm" style={{ padding: '8px 16px', borderRadius: '6px', width: 'auto' }} onClick={save} disabled={busy}>
              {busy && <span className="spin" style={{ borderTopColor: '#fff' }} />}
              Save Changes
            </button>
          </div>
        </>
      ) : (
        <>
          {hasStructuredData ? (
            <div style={{ marginBottom: 16 }}>
              {section.sectionKey === 'company_profile' ? (
                <CompanyOverviewViewer data={section.data} />
              ) : section.sectionKey === 'revenue_model' ? (
                <RevenueModelViewer data={section.data} />
              ) : section.sectionKey === 'company_metrics' ? (
                <CompanyMetricsViewer data={section.data} />
              ) : section.sectionKey === 'funding_history' ? (
                <FundingHistoryViewer data={section.data} />
              ) : section.sectionKey === 'competitors' ? (
                <CompetitorsViewer data={section.data} />
              ) : section.sectionKey === 'financial_summary' ? (
                <FinancialSummaryViewer data={section.data} />
              ) : section.sectionKey === 'recent_news' || section.sectionKey === 'news' ? (
                <RecentNewsViewer data={section.data} />
              ) : section.sectionKey === 'ai_company_summary' ? (
                <AICompanySummaryViewer data={section.data} />
              ) : (section.sectionKey === 'founders' || section.sectionKey === 'key_people' || section.sectionKey === 'products_services' || section.sectionKey === 'customers_markets' || section.sectionKey === 'competitive_advantages' || section.sectionKey === 'business_model') ? (
                <FoundersViewer data={section.data} />
              ) : (
                <DataViewer data={section.data} sectionKey={section.sectionKey} editing={false} />
              )}
            </div>
          ) : (
            <p className="hint">Nothing here yet.</p>
          )}
        </>
      )}
    </CollapsibleWrapper>
  );
}

function DataViewer({ data, sectionKey, editing, onChange }) {
  const formatKey = (k) => {
    if (k === 'ebitda_m') return 'EBITDA (Mn)';
    if (k === 'revenue_m') return 'Revenue (Mn)';
    if (k === 'growth_pct') return 'Growth (%)';
    if (k === 'year') return 'Year';
    return k.replace(/_/g, ' ');
  };

  if (Array.isArray(data)) {
    if (data.length === 0 && !editing) return null;
    return (
      <div>
        {data.map((item, idx) => (
          <div key={idx} className="card" style={{ padding: 16, marginBottom: 10, position: 'relative' }}>
            {editing && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ position: 'absolute', top: 8, right: 8, color: 'var(--red-600)' }}
                onClick={() => {
                  const newData = [...data];
                  newData.splice(idx, 1);
                  onChange(newData);
                }}
              >
                ✕ Remove
              </button>
            )}
            <div className="record-fields cols-2">
              {Object.entries(item).map(([k, v]) => (
                <label className="field" key={k}>
                  <span>{formatKey(k)}</span>
                  {editing ? (
                    typeof v === 'boolean' ? (
                      <select
                        value={v ? 'true' : 'false'}
                        onChange={(e) => {
                          const newData = [...data];
                          newData[idx] = { ...newData[idx], [k]: e.target.value === 'true' };
                          onChange(newData);
                        }}
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : Array.isArray(v) ? (
                      <input
                        type="text"
                        value={v.join(', ')}
                        onChange={(e) => {
                          const newData = [...data];
                          newData[idx] = { ...newData[idx], [k]: e.target.value.split(',').map(s => s.trim()).filter(Boolean) };
                          onChange(newData);
                        }}
                      />
                    ) : (
                      (() => {
                        const isNumField = typeof v === 'number' || k.toLowerCase().includes('value') || k.toLowerCase().includes('amount') || k.toLowerCase().includes('percent') || k.toLowerCase().includes('revenue') || k.toLowerCase().includes('year');
                        return (
                          <input
                            type={isNumField ? 'number' : k.toLowerCase().includes('date') ? 'date' : 'text'}
                            value={v ?? ''}
                            onChange={(e) => {
                              const newData = [...data];
                              newData[idx] = { ...newData[idx], [k]: isNumField ? Number(e.target.value) : e.target.value };
                              onChange(newData);
                            }}
                          />
                        );
                      })()
                    )
                  ) : (
                    <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>
                      {Array.isArray(v) ? (
                        <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {v.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      ) : (
                        v === true ? 'Yes' : v === false ? 'No' : (v || '—')
                      )}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
        {editing && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 4 }}
            onClick={() => {
              const emptyItem = data.length > 0 ? Object.fromEntries(Object.keys(data[0]).map(k => [k, typeof data[0][k] === 'number' ? 0 : typeof data[0][k] === 'boolean' ? false : ''])) : {};
              onChange([...data, emptyItem]);
            }}
          >
            + Add item
          </button>
        )}
      </div>
    );
  } else if (typeof data === 'object' && data !== null) {
    if (sectionKey === 'financial_summary' && data.financials) {
      return (
        <div>
          <h4 style={{ marginTop: 0, marginBottom: 8 }}>Financials</h4>
          <DataViewer data={data.financials} sectionKey="financials" editing={editing} onChange={editing ? (newFin) => onChange({ ...data, financials: newFin }) : undefined} />
          <h4 style={{ marginTop: 16, marginBottom: 8 }}>Observations</h4>
          {editing ? (
            <div>
              {data.observations?.map((obs, i) => (
                <div key={i} style={{ marginBottom: 12, padding: 12, background: '#f9fafb', borderRadius: 8, position: 'relative' }}>
                  <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', top: 8, right: 8, color: 'var(--red-600)' }} onClick={() => {
                    const newObs = [...data.observations];
                    newObs.splice(i, 1);
                    onChange({ ...data, observations: newObs });
                  }}>✕ Remove</button>
                  
                  {typeof obs === 'string' ? (
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span>Observation</span>
                      <textarea rows={2} value={obs} onChange={(e) => {
                        const newObs = [...data.observations];
                        newObs[i] = e.target.value;
                        onChange({ ...data, observations: newObs });
                      }} />
                    </label>
                  ) : (
                    <>
                      <label className="field" style={{ marginBottom: 8 }}>
                        <span>Title</span>
                        <input value={obs.title || ''} onChange={(e) => {
                          const newObs = [...data.observations];
                          newObs[i] = { ...obs, title: e.target.value };
                          onChange({ ...data, observations: newObs });
                        }} />
                      </label>
                      <label className="field" style={{ marginBottom: 0 }}>
                        <span>Description</span>
                        <textarea rows={2} value={obs.description || ''} onChange={(e) => {
                          const newObs = [...data.observations];
                          newObs[i] = { ...obs, description: e.target.value };
                          onChange({ ...data, observations: newObs });
                        }} />
                      </label>
                    </>
                  )}
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={() => onChange({ ...data, observations: [...(data.observations || []), ''] })}>+ Add observation</button>
            </div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {data.observations?.map((obs, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  <strong>{obs.title}</strong>
                  {obs.description && <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{obs.description}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    }
    return (
      <div className="record-fields cols-2">
        {Object.entries(data).map(([k, v]) => (
          <label className={`field ${(typeof v === 'string' && v.length > 80) ? 'full' : ''}`} key={k}>
            <span>{formatKey(k)}</span>
            {editing ? (
              Array.isArray(v) ? (
                <input value={v.join(', ')} onChange={(e) => onChange({ ...data, [k]: e.target.value.split(',').map(s => s.trim()) })} />
              ) : typeof v === 'boolean' ? (
                <select value={v ? 'true' : 'false'} onChange={(e) => onChange({ ...data, [k]: e.target.value === 'true' })}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (typeof v === 'string' && v.length > 80) ? (
                <textarea
                  value={v || ''}
                  rows={3}
                  onChange={(e) => onChange({ ...data, [k]: e.target.value })}
                />
              ) : (
                <input
                  type={typeof v === 'number' ? 'number' : 'text'}
                  value={v ?? ''}
                  onChange={(e) => onChange({ ...data, [k]: typeof v === 'number' ? Number(e.target.value) : e.target.value })}
                />
              )
            ) : (
              <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>
                {Array.isArray(v) ? v.join(', ') : (v || <span className="cp-empty-field">N/A</span>)}
              </span>
            )}
          </label>
        ))}
      </div>
    );
  }
  return null;
}

function FoundersSection({ companyId, founders, section, onChanged }) {
  const { toast, error: toastError } = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      await profileApi.addFounder(companyId, { name: 'New founder' });
      await onChanged();
    } catch (e) { toastError(e); }
    finally { setBusy(false); }
  }

  async function remove(id) {
    const ok = await confirm({
      title: 'Remove founder',
      message: 'Remove this founder? This cannot be undone.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await profileApi.removeFounder(companyId, id);
      toast('Founder removed.');
      await onChanged();
    } catch (e) { toastError(e); }
  }

  const foundersIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );

  return (
    <CollapsibleWrapper
      id={`sec-${section.sectionKey}`}
      title={section.label}
      needsInput={false}
      icon={foundersIcon}
      actions={
        <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={add} disabled={busy}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Founder
        </button>
      }
    >
      {founders.length === 0 && <p className="hint">No founders added yet.</p>}
      {founders.map((f) => (
        <FounderCard
          key={f.id}
          companyId={companyId}
          founder={f}
          onRemove={() => remove(f.id)}
          onChanged={onChanged}
        />
      ))}
    </CollapsibleWrapper>
  );
}

function FounderCard({ companyId, founder, onRemove, onChanged }) {
  const { toast, error: toastError } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(founder);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDraft(founder); }, [founder]);

  async function save() {
    setBusy(true);
    try {
      await profileApi.updateFounder(companyId, founder.id, {
        name: draft.name,
        designation: draft.designation,
        linkedinUrl: draft.linkedinUrl,
        experience: draft.experience,
        education: draft.education,
        biography: draft.biography,
        isFullTime: draft.isFullTime,
      });
      toast('Founder updated.');
      setEditing(false);
      await onChanged();
    } catch (e) { toastError(e); }
    finally { setBusy(false); }
  }

  if (!editing) {
    return (
      <div className="founder-card">
        <div className="spread">
          <div>
            <strong>{founder.name || 'Unnamed founder'}</strong>
            {founder.designation && <span className="hint"> · {founder.designation}</span>}
          </div>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn btn-ghost btn-sm" onClick={onRemove}>Remove</button>
          </div>
        </div>
        {founder.biography && <p className="hint">{founder.biography}</p>}
        <div className="row founder-tags">
          {founder.isFullTime && <Pill value="active">Full-time</Pill>}
          {founder.linkedinUrl && founder.selfConfirmed && (
            <Pill value="approved">Confirmed by founder</Pill>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="founder-card">
      {[['name', 'Name'], ['designation', 'Designation'],
      ['linkedinUrl', 'LinkedIn'], ['education', 'Education']].map(([k, label]) => (
        <label className="field" key={k}>
          <span>{label}</span>
          <input
            type="text"
            value={draft[k] || ''}
            onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
          />
        </label>
      ))}
      <label className="field">
        <span>Biography</span>
        <textarea
          rows={4}
          value={draft.biography || ''}
          onChange={(e) => setDraft({ ...draft, biography: e.target.value })}
        />
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={!!draft.isFullTime}
          onChange={(e) => setDraft({ ...draft, isFullTime: e.target.checked })}
        />
        <span>Working on this full-time</span>
      </label>
      <div className="row">
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>Save</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}

// QA issue 2: per-section empty-state copy. Only Competitors is genuinely
// populated from market benchmarking data; the others are the founder's own
// information and must not claim otherwise.
// ===========================================================================
// Record-backed list sections (Key People, Competitors, Funding History,
// Recent News). One schema-driven component for all four — the same
// philosophy as Founders, generalised. Each record is a real backing row
// with full add / edit / delete, plus the founder's own free-text notes and
// the standard Regenerate / History actions carried over from before.
// ===========================================================================

// Per-section field schemas. `type` drives the input; `full` spans both
// grid columns. Kept in the frontend so the editors render without a config
// round-trip; the backend validates independently (records.RECORD_TYPES).
const RECORD_SCHEMAS = {
  key_people: {
    singular: 'person',
    titleField: 'name',
    subtitleField: 'designation',
    dataKey: 'keyPeople',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'designation', label: 'Designation' },
      { key: 'linkedinUrl', label: 'LinkedIn', type: 'url' },
      { key: 'biography', label: 'Biography', type: 'textarea', full: true },
    ],
  },
  competitors: {
    singular: 'competitor',
    titleField: 'name',
    subtitleField: 'geography',
    dataKey: 'competitors',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'website', label: 'Website', type: 'url' },
      { key: 'geography', label: 'Geography' },
      { key: 'fundingRaisedUsd', label: 'Funding raised (USD)', type: 'number' },
      { key: 'positioning', label: 'Positioning', type: 'textarea', full: true },
      { key: 'description', label: 'Description', type: 'textarea', full: true },
    ],
  },
  funding_history: {
    singular: 'round',
    titleField: 'roundName',
    subtitleField: 'announcedDate',
    dataKey: 'fundingRounds',
    fields: [
      { key: 'roundName', label: 'Round' },
      { key: 'announcedDate', label: 'Announced date', type: 'date' },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'ccy', label: 'Currency' },
      { key: 'preMoneyValue', label: 'Pre-money', type: 'number' },
      { key: 'postMoneyValue', label: 'Post-money', type: 'number' },
      { key: 'leadInvestor', label: 'Lead investor' },
      { key: 'investors', label: 'Other investors (comma-separated)' },
      { key: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
  },
  recent_news: {
    singular: 'item',
    titleField: 'headline',
    subtitleField: 'publisher',
    dataKey: 'news',
    fields: [
      { key: 'headline', label: 'Headline', required: true, full: true },
      { key: 'url', label: 'URL', type: 'url', full: true },
      { key: 'publisher', label: 'Publisher' },
      { key: 'publishedDate', label: 'Published date', type: 'date' },
      { key: 'summary', label: 'Summary', type: 'textarea', full: true },
    ],
  },
};

// QA issue 2 (retained): only Competitors is benchmark-driven. The others
// are the founder's own information, so each keeps an honest empty state.
const EMPTY_COPY = {
  competitors: {
    key: 'benchmark.data_unavailable',
    text: "Live market benchmarking data isn't connected yet. Add competitors manually and the analysis will use those.",
  },
  key_people: {
    key: 'empty.key_people',
    text: 'No key people added yet. Add the leaders and advisors who matter to your story.',
  },
  funding_history: {
    key: 'empty.funding_history',
    text: 'No funding history yet. Add your past rounds — date, amount and lead investors.',
  },
  recent_news: {
    key: 'empty.recent_news',
    text: 'No recent news yet. Add notable coverage, milestones or announcements.',
  },
};

function RecordListSection({ companyId, section, profileData, onChanged }) {
  const { copy } = useConfig();
  const { toast, error: toastError } = useToast();
  const confirm = useConfirm();
  const schema = RECORD_SCHEMAS[section.sectionKey];
  const items = (schema && profileData[schema.dataKey]) || [];

  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  // Founder's own free-text notes for the section, plus Regenerate/History —
  // preserved from the previous ListSection so nothing regresses.
  const [editingNotes, setEditingNotes] = useState(false);
  const [draft, setDraft] = useState(section.content || '');
  const [history, setHistory] = useState(null);
  useEffect(() => { setDraft(section.content || ''); }, [section.content]);

  async function saveNotes() {
    setBusy(true);
    try {
      await profileApi.saveSection(companyId, section.sectionKey, { content: draft });
      toast(`${section.label} saved.`);
      setEditingNotes(false);
      await onChanged?.();
    } catch (e) { toastError(e); }
    finally { setBusy(false); }
  }

  async function regenerate(force = false) {
    setBusy(true);
    try {
      const res = await profileApi.regenerateSection(companyId, section.sectionKey, force);
      if (res?.status === 'confirm_required') {
        const ok = await confirm({
          title: 'Regenerate this section?',
          message: `${res.message}\n\nRegenerate anyway?`,
          confirmLabel: 'Regenerate', tone: 'danger',
        });
        if (ok) return regenerate(true);
        return;
      }
      toast(`${section.label} regenerated.`);
      await onChanged?.();
    } catch (e) { toastError(e); }
    finally { setBusy(false); }
  }

  async function loadHistory() {
    try {
      const res = await profileApi.sectionHistory(companyId, section.sectionKey);
      setHistory(res.items || []);
    } catch (e) { toastError(e); }
  }

  async function removeRecord(id) {
    const ok = await confirm({
      title: `Remove ${schema.singular}`,
      message: `Remove this ${schema.singular}? This cannot be undone.`,
      confirmLabel: 'Remove', tone: 'danger',
    });
    if (!ok) return;
    try {
      await profileApi.removeRecord(companyId, section.sectionKey, id);
      toast('Removed.');
      await onChanged?.();
    } catch (e) { toastError(e); }
  }

  if (!schema) return null;

  return (
    <CollapsibleWrapper id={`sec-${section.sectionKey}`} title={section.label} needsInput={false}>
      <div className="panel-title">
        <div style={{ flex: 1 }} />
        <div className="row">
          {items.length > 0 && section.source === 'ai_research' && <AiBadge />}
          <button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
            + Add {schema.singular}
          </button>
        </div>
      </div>

      {items.length === 0 && !adding && (
        <p className="hint empty-note">
          {EMPTY_COPY[section.sectionKey]
            ? copy(EMPTY_COPY[section.sectionKey].key, EMPTY_COPY[section.sectionKey].text)
            : 'Nothing here yet — add a record above.'}
        </p>
      )}

      <div className="record-list">
        {adding && (
          <RecordCard
            companyId={companyId}
            sectionKey={section.sectionKey}
            schema={schema}
            record={null}
            startEditing
            onDone={() => setAdding(false)}
            onChanged={onChanged}
          />
        )}
        {items.map((it) => (
          <RecordCard
            key={it.id}
            companyId={companyId}
            sectionKey={section.sectionKey}
            schema={schema}
            record={it}
            onRemove={() => removeRecord(it.id)}
            onChanged={onChanged}
          />
        ))}
      </div>

      {/* Founder's own notes + standard section actions. */}
      {editingNotes ? (
        <>
          <textarea
            className="section-editor"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Add ${section.label.toLowerCase()} notes here.`}
            rows={5}
          />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={saveNotes} disabled={busy}>
              {busy && <span className="spin" style={{ borderTopColor: '#fff' }} />}Save
            </button>
            <button className="btn btn-secondary btn-sm"
              onClick={() => { setDraft(section.content || ''); setEditingNotes(false); }}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          {section.content && <div className="section-content" style={{ marginTop: 12 }}>{section.content}</div>}
          <div className="row section-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditingNotes(true)}>
              {section.content ? 'Edit notes' : 'Add notes'}
            </button>
            {section.isRegenerable && (
              <button className="btn btn-secondary btn-sm" onClick={() => regenerate(false)} disabled={busy}>
                {busy && <span className="spin" />}Regenerate with AI
              </button>
            )}
            <button className="btn btn-ghost btn-sm"
              onClick={() => (history ? setHistory(null) : loadHistory())}>
              {history ? 'Hide history' : 'History'}
            </button>
          </div>
          {history && (
            <div className="history-list">
              {history.length === 0
                ? <p className="hint">No earlier versions yet.</p>
                : history.map((h) => (
                  <div key={h.versionNo} className="history-row">
                    <div className="spread">
                      <strong>v{h.versionNo}</strong>
                      <span className="hint">{h.changeSummary} · {fmtDate(h.changedAt)}</span>
                    </div>
                    <p className="hint history-excerpt">{(h.content || '').slice(0, 260)}</p>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </CollapsibleWrapper>
  );
}

function RecordCard({ companyId, sectionKey, schema, record, onRemove, onChanged, startEditing = false, onDone }) {
  const { toast, error: toastError } = useToast();
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(() => record || {});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (record) setDraft(record); }, [record]);

  function validate() {
    const errs = {};
    for (const f of schema.fields) {
      if (f.required && !String(draft[f.key] || '').trim()) {
        errs[f.key] = 'Required.';
      }
      if (f.type === 'number' && draft[f.key] != null && draft[f.key] !== ''
        && Number.isNaN(Number(draft[f.key]))) {
        errs[f.key] = 'Enter a number.';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);
    // Only send known fields.
    const body = {};
    for (const f of schema.fields) if (draft[f.key] !== undefined) body[f.key] = draft[f.key];
    try {
      if (record) {
        await profileApi.updateRecord(companyId, sectionKey, record.id, body);
        toast('Saved.');
      } else {
        await profileApi.addRecord(companyId, sectionKey, body);
        toast('Added.');
      }
      setEditing(false);
      onDone?.();
      await onChanged?.();
    } catch (e) {
      // Attach server-side field errors when present.
      if (e?.fields) setErrors(e.fields);
      toastError(e);
    } finally { setBusy(false); }
  }

  function cancel() {
    setDraft(record || {});
    setErrors({});
    setEditing(false);
    onDone?.();
  }

  if (!editing) {
    const title = draft[schema.titleField] || `Untitled ${schema.singular}`;
    const subtitle = draft[schema.subtitleField];
    return (
      <div className="record-card">
        <div className="spread">
          <div>
            <div className="record-card-title">{title}</div>
            {subtitle && <span className="hint">{subtitle}</span>}
          </div>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
            {onRemove && <button className="btn btn-ghost btn-sm" onClick={onRemove}>Remove</button>}
          </div>
        </div>
        <div className="record-meta-row">
          {schema.fields
            .filter((f) => !['name', 'headline', 'roundName'].includes(f.key))
            .map((f) => {
              const v = draft[f.key];
              if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return null;
              const shown = Array.isArray(v) ? v.join(', ') : String(v);
              return <span key={f.key} className="hint">{f.label}: {shown}</span>;
            })}
        </div>
      </div>
    );
  }

  return (
    <div className="record-card">
      <div className="record-fields cols-2">
        {schema.fields.map((f) => (
          <label className={`field ${f.full ? 'full' : ''}`} key={f.key}>
            <span>{f.label}{f.required ? ' *' : ''}</span>
            {f.type === 'textarea' ? (
              <textarea
                rows={3}
                className={errors[f.key] ? 'invalid' : ''}
                value={draft[f.key] || ''}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              />
            ) : (
              <input
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                className={errors[f.key] ? 'invalid' : ''}
                value={draft[f.key] == null ? '' : draft[f.key]}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              />
            )}
            {errors[f.key] && <span className="field-error">{errors[f.key]}</span>}
          </label>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
          {busy && <span className="spin" style={{ borderTopColor: '#fff' }} />}Save
        </button>
        <button className="btn btn-secondary btn-sm" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );
}

// ===========================================================================
// Structured numeric forms — Revenue Model, Company Metrics, Financial
// Summary. Each is a small validated table stored on section.structured.
// A per-row field-level "Regenerate" pulls an AI suggestion for one cell
// without touching the founder's other entries.
// ===========================================================================
const STRUCTURED_SCHEMAS = {
  revenue_model: {
    addLabel: 'revenue stream',
    sumTo100: { field: 'pct', label: 'Shares' },
    columns: [
      { key: 'label', label: 'Stream', type: 'text', ai: true },
      { key: 'pct', label: 'Share %', type: 'number' },
    ],
  },
  company_metrics: {
    addLabel: 'metric',
    columns: [
      { key: 'label', label: 'Metric', type: 'text', ai: true },
      { key: 'value', label: 'Value', type: 'number' },
      { key: 'unit', label: 'Unit', type: 'text' },
    ],
  },
  financial_summary: {
    addLabel: 'fiscal year',
    columns: [
      { key: 'fiscalYear', label: 'FY', type: 'text' },
      { key: 'revenue', label: 'Revenue', type: 'number' },
      { key: 'grossMarginPct', label: 'Gross margin %', type: 'number' },
      { key: 'ebitda', label: 'EBITDA', type: 'number' },
      { key: 'ccy', label: 'Ccy', type: 'text' },
    ],
  },
};

function StructuredFormSection({ companyId, section, onChanged }) {
  const { toast, error: toastError } = useToast();
  const schema = STRUCTURED_SCHEMAS[section.sectionKey];
  const [rows, setRows] = useState(() => (section.structured?.items) || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [regenKey, setRegenKey] = useState(null); // "rowIdx:colKey" being regenerated

  useEffect(() => { setRows((section.structured?.items) || []); }, [section.structured]);

  function setCell(i, key, value) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function addRow() { setRows((rs) => [...rs, {}]); }
  function removeRow(i) { setRows((rs) => rs.filter((_, idx) => idx !== i)); }

  const sumField = schema.sumTo100?.field;
  const sum = sumField ? rows.reduce((a, r) => a + (Number(r[sumField]) || 0), 0) : null;
  const sumOk = sum == null || Math.abs(sum - 100) <= 0.5;

  async function save() {
    setError('');
    if (sumField && rows.length && !sumOk) {
      setError(`${schema.sumTo100.label} must total 100% (currently ${sum}%).`);
      return;
    }
    setBusy(true);
    try {
      await profileApi.saveStructuredForm(companyId, section.sectionKey, rows);
      toast(`${section.label} saved.`);
      await onChanged?.();
    } catch (e) {
      setError(e?.detail || e?.message || 'Could not save.');
      toastError(e);
    } finally { setBusy(false); }
  }

  async function regenCell(i, col) {
    const rk = `${i}:${col.key}`;
    setRegenKey(rk);
    try {
      const res = await profileApi.regenerateField(companyId, section.sectionKey, col.key);
      if (res?.status === 'ok') { setCell(i, col.key, res.value); toast('Suggestion applied.'); }
      else if (res?.message) toastError(res.message);
    } catch (e) { toastError(e); }
    finally { setRegenKey(null); }
  }

  return (
    <CollapsibleWrapper id={`sec-${section.sectionKey}`} title={section.label} needsInput={section.needsInput && rows.length === 0}>
      <div className="panel-title" style={{ marginBottom: 16 }}>
        <div style={{ flex: 1 }} />
        {section.needsInput && rows.length === 0 && <Pill value="pending">Needs input</Pill>}
      </div>

      {rows.length === 0 && (
        <p className="hint empty-note">Nothing here yet — add a {schema.addLabel} below.</p>
      )}

      {rows.length > 0 && (
        <table className="struct-table">
          <thead>
            <tr>
              {schema.columns.map((c) => <th key={c.key}>{c.label}</th>)}
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {schema.columns.map((c) => (
                  <td key={c.key}>
                    <div className={c.ai ? 'field-with-ai row' : ''}>
                      <input
                        type={c.type === 'number' ? 'number' : 'text'}
                        value={r[c.key] == null ? '' : r[c.key]}
                        onChange={(e) => setCell(i, c.key, e.target.value)}
                      />
                      {c.ai && (
                        <button
                          type="button"
                          className="field-regen"
                          disabled={regenKey === `${i}:${c.key}`}
                          onClick={() => regenCell(i, c)}
                          title="Suggest with AI"
                        >
                          {regenKey === `${i}:${c.key}` ? '…' : 'AI'}
                        </button>
                      )}
                    </div>
                  </td>
                ))}
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeRow(i)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sumField && rows.length > 0 && (
        <p className="hint" style={{ marginTop: 8 }}>
          {schema.sumTo100.label} total:{' '}
          <span className={sumOk ? 'struct-total-ok' : 'struct-total-bad'}>{sum}%</span>
        </p>
      )}
      {error && <p className="field-error">{error}</p>}

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-secondary btn-sm add-row-btn" onClick={addRow}>
          + Add {schema.addLabel}
        </button>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
          {busy && <span className="spin" style={{ borderTopColor: '#fff' }} />}Save
        </button>
      </div>
    </CollapsibleWrapper>
  );
}

/**
 * Document Center (PRD §5.4).
 *
 * C7 — artefacts produced by the former Stage 3 (teasers, decks, IMs,
 * models) are retained here as read-only addenda to the company. Each is
 * slated to return as a dedicated assistant, so nothing is deleted and
 * nothing is silently reassigned to the new Stage 3.
 */
function DocumentCenter({ companyId, section, profileData, onChanged }) {
  const { copy } = useConfig();
  const { toast, error: toastError } = useToast();
  // QA 24-Jul issue 4: documents could only be attached during onboarding.
  // The Document Center now uploads at any time.
  const fileRef = useRef(null);
  const [category, setCategory] = useState('other');
  const [uploading, setUploading] = useState(false);

  async function upload(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    setUploading(true);
    try {
      for (const file of list) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', category);
        await profileApi.uploadDocument(companyId, fd);
      }
      toast(list.length === 1
        ? `${list[0].name} uploaded.`
        : `${list.length} documents uploaded.`);
      await onChanged?.();
    } catch (e) { toastError(e); }
    finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const docs = profileData.documents || [];
  const groups = docs.reduce((acc, d) => {
    (acc[d.category] ||= []).push(d);
    return acc;
  }, {});
  const legacy = docs.filter((d) => d.isReadonly);

  const LABELS = {
    company_presentation: 'Company Presentation',
    financial_model: 'Financial Model',
    annual_report: 'Annual Report / Financial Statements',
    other: 'Other Documents',
    teaser: 'Teaser',
    pitch_deck: 'Pitch Deck',
    information_memorandum: 'Information Memorandum',
  };

  return (
    <CollapsibleWrapper id={`sec-${section.sectionKey}`} title={section.label} needsInput={false}>

      {/* Upload is always available — documents can be added at any time,
          not only during onboarding. */}
      <div
        className="doc-upload"
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
      >
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Document type"
            style={{ maxWidth: 240 }}
          >
            <option value="company_presentation">Company Presentation</option>
            <option value="financial_model">Financial Model</option>
            <option value="annual_report">Annual Report / Financial Statements</option>
            <option value="business_plan">Business Plan</option>
            <option value="other">Other Documents</option>
          </select>
          <input
            ref={fileRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => upload(e.target.files)}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading && <span className="spin" style={{ borderTopColor: '#fff' }} />}
            Upload document
          </button>
        </div>
        <p className="hint" style={{ margin: '8px 0 0' }}>
          Drag files here, or use the button. PDF, Word, PowerPoint, Excel,
          CSV and images are supported.
        </p>
      </div>

      {Object.keys(groups).length === 0 && (
        <p className="hint">No documents yet.</p>
      )}

      {Object.entries(groups).map(([cat, list]) => (
        <div key={cat} className="doc-group">
          <div className="eyebrow">{LABELS[cat] || cat}</div>
          <ul className="file-list">
            {list.map((d) => (
              <li key={d.id}>
                {/* C7 — migrated investor materials must be openable, not
                    just listed. Falls back to plain text when nothing is
                    stored for the document. */}
                {d.downloadUrl ? (
                  <a href={d.downloadUrl} target="_blank" rel="noopener noreferrer">
                    {d.filename || 'Document'}
                  </a>
                ) : (
                  <span>{d.filename || 'Document'}</span>
                )}
                {d.isReadonly && <Pill value="pending">Read-only</Pill>}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {legacy.length > 0 && (
        <p className="hint empty-note" style={{ marginTop: 12 }}>
          {copy('materials.readonly',
            'Investor materials generated earlier remain available here. New material generation is being rebuilt as a dedicated assistant.')}
        </p>
      )}

      {/* PRD §5.4 — present but disabled until the assistants ship. */}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn btn-secondary btn-sm" disabled title="Coming soon">
          Generate Presentation
        </button>
        <button className="btn btn-secondary btn-sm" disabled title="Coming soon">
          Generate Financial Model
        </button>
      </div>
    </CollapsibleWrapper>
  );
}
