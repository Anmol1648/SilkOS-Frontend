import { useEffect, useState } from 'react';
import { config as configApi, companies, profile as profileApi } from '../api/endpoints';
import { useToast } from '../context/AppContext';

/**
 * AddCompanyModal — a single combined modal that creates a company AND
 * submits onboarding data (website, country, founders, documents) in one
 * flow. Replaces the old two-step: "AddCompany inline form" → navigate to
 * OnboardingForm.
 *
 * Design matches the Clarum "Add Company" modal reference exactly.
 */

const UPLOAD_CATEGORIES = [
  { key: 'company_presentation', label: 'Company Presentation' },
  { key: 'financial_model', label: 'Financial Model' },
  { key: 'annual_report', label: 'Annual Report / Financial Statements' },
  { key: 'other', label: 'Other Documents' },
];

const ACCEPTED = '.pdf,.docx,.doc,.ppt,.pptx,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.zip';

export default function AddCompanyModal({ onCancel, onCreated }) {
  const { toast, error: toastError } = useToast();

  /* ---- state ---- */
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [country, setCountry] = useState('');
  const [countries, setCountries] = useState([]);
  const [founders, setFounders] = useState([
    { name: '', linkedinUrl: '', isFullTime: false, selfConfirmed: false },
  ]);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState({});

  useEffect(() => {
    configApi.countries()
      .then((r) => setCountries(r.items || []))
      .catch(() => setCountries([]));
  }, []);

  /* Close on Escape */
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  /* ---- founder helpers ---- */
  const setFounder = (i, patch) =>
    setFounders((list) => list.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const addFounder = () =>
    setFounders((l) => [...l, { name: '', linkedinUrl: '', isFullTime: false, selfConfirmed: false }]);

  const removeFounder = (i) =>
    setFounders((l) => (l.length === 1 ? l : l.filter((_, idx) => idx !== i)));

  /* ---- file helpers ---- */
  function onPick(e, category) {
    const picked = [...e.target.files].map((file) => ({ file, category }));
    setFiles((f) => [...f, ...picked]);
    e.target.value = '';
  }

  /* ---- validation ---- */
  function validate() {
    const next = {};
    if (!companyName.trim()) next.companyName = 'Company name is required.';
    setErrs(next);
    return Object.keys(next).length === 0;
  }

  /* ---- submit: create company + onboard in one shot ---- */
  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      /* Step 1: create the company */
      const res = await companies.create({ name: companyName.trim() });
      const companyId = res?.id || res?.companyId;
      if (!companyId) throw new Error('Company was created but no id was returned.');

      /* Step 2: upload documents if any */
      if (files.length) {
        for (const item of files) {
          try {
            const fd = new FormData();
            fd.append('file', item.file);
            fd.append('category', item.category);
            await profileApi.uploadDocument(companyId, fd);
          } catch (ex) {
            toastError(new Error(`Couldn't upload ${item.file.name} — continuing without it.`));
          }
        }
      }

      /* Step 3: onboard with collected metadata */
      const url = website.trim()
        ? (website.trim().startsWith('http') ? website.trim() : `https://${website.trim()}`)
        : undefined;

      await profileApi.onboard(companyId, {
        ...(url ? { websiteUrl: url } : {}),
        ...(country ? { hqCountry: country } : {}),
        founders: founders
          .filter((f) => f.name.trim() || f.linkedinUrl.trim())
          .map((f) => ({
            name: f.name.trim(),
            linkedinUrl: f.linkedinUrl.trim(),
            isFullTime: f.isFullTime,
            selfConfirmed: f.selfConfirmed,
          })),
      });

      toast('Building your company profile…');
      onCreated(companyId);
    } catch (ex) {
      setErrs(ex.fields || {});
      toastError(ex);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="acm-overlay" onClick={onCancel}>
      <div
        className="acm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add Company"
      >
        {/* ---- Header ---- */}
        <div className="acm-header">
          <h2 className="acm-title">Add Company</h2>
          <button
            type="button"
            className="acm-close"
            onClick={onCancel}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="acm-subtitle">
          Tell us about the company so we can build a comprehensive profile.
        </p>

        {/* ---- Form ---- */}
        <form onSubmit={submit} className="acm-form">
          {/* Company name */}
          <label className="acm-field acm-field-full">
            <span className="acm-label">Company name <span className="acm-req">*</span></span>
            <input
              type="text"
              className="acm-input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name"
              autoFocus
            />
            {errs.companyName && <span className="acm-error">{errs.companyName}</span>}
          </label>

          {/* Website + Country row */}
          <div className="acm-row-2">
            <label className="acm-field">
              <span className="acm-label">Company website</span>
              <div className="acm-input-icon">
                <span className="acm-input-icon-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="acm-input acm-input-with-icon"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://acme.com"
                />
              </div>
            </label>
            <label className="acm-field">
              <span className="acm-label">Headquarters country</span>
              <div className="acm-select-wrap">
                <select
                  className="acm-select"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="">Select a country…</option>
                  {countries.map((c) => (
                    <option key={c.iso2} value={c.iso2}>{c.name}</option>
                  ))}
                </select>
                <svg className="acm-select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </label>
          </div>

          {/* ---- Founders ---- */}
          <div className="acm-section">
            <div className="acm-section-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <h3 className="acm-section-title">Founders</h3>
            </div>
            <p className="acm-section-desc">
              LinkedIn is optional. If you add a profile URL we'll use the public
              information on it to pre-fill the founder details, which you can then edit.
            </p>

            {founders.map((f, i) => (
              <div key={i} className="acm-founder-card">
                <div className="acm-founder-fields">
                  <label className="acm-field acm-founder-name">
                    <span className="acm-label">Name</span>
                    <input
                      type="text"
                      className="acm-input"
                      value={f.name}
                      placeholder="Full name"
                      onChange={(e) => setFounder(i, { name: e.target.value })}
                    />
                  </label>
                  <label className="acm-field acm-founder-linkedin">
                    <span className="acm-label">LinkedIn profile <span className="acm-optional">(optional)</span></span>
                    <div className="acm-input-icon">
                      <span className="acm-input-icon-left acm-linkedin-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                      </span>
                      <input
                        type="text"
                        className="acm-input acm-input-with-icon"
                        value={f.linkedinUrl}
                        placeholder="https://linkedin.com/in/…"
                        onChange={(e) => setFounder(i, { linkedinUrl: e.target.value })}
                      />
                    </div>
                  </label>
                  {founders.length > 1 && (
                    <button
                      type="button"
                      className="acm-remove-btn"
                      onClick={() => removeFounder(i)}
                      aria-label="Remove founder"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
                <label className="acm-check">
                  <input
                    type="checkbox"
                    checked={f.isFullTime}
                    onChange={(e) => setFounder(i, { isFullTime: e.target.checked })}
                  />
                  <span>Working on this full-time</span>
                </label>
              </div>
            ))}

            <button type="button" className="acm-add-founder" onClick={addFounder}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Founder
            </button>
          </div>

          {/* ---- Documents ---- */}
          <div className="acm-section">
            <div className="acm-section-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <h3 className="acm-section-title">Existing documents</h3>
            </div>
            <p className="acm-section-desc">
              Anything you already have helps — a deck, your model, financial
              statements. PDF, Word, PowerPoint, Excel, CSV, images or ZIP.
            </p>

            <div className="acm-upload-grid">
              {UPLOAD_CATEGORIES.map((cat) => (
                <label key={cat.key} className="acm-upload-tile">
                  <input
                    type="file"
                    multiple
                    accept={ACCEPTED}
                    onChange={(e) => onPick(e, cat.key)}
                    style={{ display: 'none' }}
                  />
                  <span className="acm-upload-label">{cat.label}</span>
                  <span className="acm-upload-count">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {files.filter((f) => f.category === cat.key).length
                      ? `${files.filter((f) => f.category === cat.key).length} file(s)`
                      : 'No file(s)'}
                  </span>
                </label>
              ))}
            </div>

            {files.length > 0 && (
              <ul className="acm-file-list">
                {files.map((f, i) => (
                  <li key={i}>
                    <span>{f.file.name}</span>
                    <button
                      type="button"
                      className="acm-remove-file"
                      onClick={() => setFiles((l) => l.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---- Footer ---- */}
          <div className="acm-footer">
            <span className="acm-footer-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              You can add or change anything after the profile is generated.
            </span>
            <div className="acm-footer-actions">
              <button type="button" className="acm-btn-cancel" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="acm-btn-submit" disabled={busy}>
                {busy && <span className="spin" style={{ borderTopColor: '#fff', width: 14, height: 14 }} />}
                Generate Company Profile
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
