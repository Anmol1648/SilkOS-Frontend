import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { companies, me } from '../api/endpoints';
import { useAuth, useToast } from '../context/AppContext';
import { useConfig } from '../context/ConfigContext';
import { Skeleton } from '../components/ui';
import { Illo } from '../components/illos';
import { fmtDate } from '../lib/format';

/**
 * Dashboard — the landing page after login (PRD §4).
 *
 * Changes from the previous picker:
 *  - "+ Add Company" sits top-right beside Sign out (§4.2). The former
 *    bottom-of-page "New company or deal" button is gone.
 *  - No "Create first deal" affordance: a fundraise can never be created
 *    before a company exists (§4.1).
 *  - Cards show logo, name, industry, current stage and last-updated (§4.3).
 *  - "Open" resumes where the founder left off — Stage 1 while the profile
 *    is incomplete, otherwise the last active stage (§4.4). The destination
 *    is decided server-side so every client agrees.
 *  - "+ Add Company" goes straight into Stage 1; there is no intermediate
 *    company-or-deal chooser (§4.5).
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { error: toastError } = useToast();
  const { brand } = useConfig();
  const [items, setItems] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = () => me.contexts()
    .then((res) => setItems(res.items || []))
    .catch((e) => { toastError(e); setItems([]); });

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Group by company: one card per company, however many deals it has.
  // C1 — a company is independent and may hold several concurrent raises.
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
        deals: [],
      });
    }
    const row = byCompany.get(key);
    if (it.dealId) row.deals.push(it);
    if (it.updatedAt && (!row.updatedAt || it.updatedAt > row.updatedAt)) {
      row.updatedAt = it.updatedAt;
    }
  }
  const cards = [...byCompany.values()];

  return (
    <div className="dash-wrap">
      <header className="dash-header">
        <div>
          <div className="wordmark-lg">
            {(brand.logoMonoUrl || brand.logoUrl)
              ? <img src={brand.logoMonoUrl || brand.logoUrl}
                     alt={brand.productName} className="brand-logo" />
              : brand.productName}
          </div>
          {user?.email && <p className="hint">Signed in as {user.email}</p>}
        </div>
        <div className="row">
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
            + Add Company
          </button>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Sign out</button>
        </div>
      </header>

      {adding && (
        <AddCompany
          onCancel={() => { setAdding(false); load(); }}
          onCreated={(companyId) => navigate(`/companies/${companyId}/profile`)}
        />
      )}

      {!adding && items === null && (
        <>
          <Skeleton h={92} style={{ marginBottom: 12 }} />
          <Skeleton h={92} />
        </>
      )}

      {!adding && items !== null && cards.length === 0 && (
        <div className="gate-panel">
          <span className="illo-wrap"><Illo name="handshake" size={110} /></span>
          <h2>Welcome to {brand.productName}</h2>
          <p className="hint" style={{ maxWidth: 460, margin: '0 auto 18px' }}>
            Add your company and {brand.productName} will build a complete company
            profile from your website, your documents and public sources — then help
            you plan the raise.
          </p>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            + Add Company
          </button>
        </div>
      )}

      {!adding && cards.length > 0 && (
        <div className="company-grid">
          {cards.map((c) => (
            <CompanyCard key={c.companyId || c.companyName} company={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyCard({ company }) {
  const navigate = useNavigate();
  const { stageLabel } = useConfig();

  // §4.4 — resume where the founder left off. The server supplies the
  // destination; the fallbacks only cover an older API response.
  function open() {
    if (company.resumePath) { navigate(company.resumePath); return; }
    if (company.profileComplete && company.deals.length) {
      const stage = company.stageNo && company.stageNo > 0 ? company.stageNo : 1;
      navigate(`/deals/${company.deals[0].dealId}/stage/${stage}`);
      return;
    }
    navigate(`/companies/${company.companyId}/profile`);
  }

  const label = company.stageLabel
    || (company.stageNo != null ? stageLabel(company.stageNo) : 'Getting started');

  return (
    <div className="company-card">
      <div className="company-card-top">
        <span className="company-logo" aria-hidden="true">
          {company.logoUrl
            ? <img src={company.logoUrl} alt="" />
            : (company.companyName || '?').slice(0, 1).toUpperCase()}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="company-name">{company.companyName}</h3>
          {company.industry && <p className="hint company-industry">{company.industry}</p>}
        </div>
      </div>

      <dl className="company-meta">
        <div>
          <dt>Current stage</dt>
          <dd>{label}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{company.updatedAt ? fmtDate(company.updatedAt) : '—'}</dd>
        </div>
      </dl>

      {company.deals.length > 1 && (
        <p className="hint" style={{ marginTop: 2 }}>
          {company.deals.length} active raises
        </p>
      )}

      <button className="btn btn-primary btn-sm company-open" onClick={open}>
        Open →
      </button>
    </div>
  );
}

/**
 * §4.5 — adding a company starts Stage 1 directly. The only thing collected
 * here is the name; everything else is gathered by the onboarding form on
 * the Company Profile page, which is where the founder is sent next.
 */
function AddCompany({ onCancel, onCreated }) {
  const { error: toastError } = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState({});

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setErrs({ name: 'Company name is required.' }); return; }
    setBusy(true);
    try {
      const res = await companies.create({ name: name.trim() });
      const id = res?.id || res?.companyId;
      if (!id) throw new Error('Company was created but no id was returned.');
      onCreated(id);
    } catch (ex) {
      setErrs(ex.fields || {});
      toastError(ex);
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <form onSubmit={submit}>
        <h2>Add your company</h2>
        <p className="hint" style={{ marginBottom: 14 }}>
          Next you'll add your website and documents, and we'll build the
          company profile from them.
        </p>
        <label className="field">
          <span>Company name *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Technologies"
            autoFocus
          />
          {errs.name && <span className="field-error">{errs.name}</span>}
        </label>
        <div className="step-nav">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy && <span className="spin" style={{ borderTopColor: '#fff' }} />}
            Continue →
          </button>
        </div>
      </form>
    </div>
  );
}
