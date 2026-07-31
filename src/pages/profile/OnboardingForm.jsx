import { useEffect, useState } from 'react';
import { config as configApi, profile as profileApi, stage1 } from '../../api/endpoints';
import { useToast } from '../../context/AppContext';
import { useConfig } from '../../context/ConfigContext';
import { Illo } from '../../components/illos';

/**
 * Single onboarding form (PRD §5.2).
 *
 * Replaces the previous four-step wizard entirely. One screen, one submit.
 *
 * C3 — founder LinkedIn is OPTIONAL, not mandatory. When supplied it is
 * processed from the public profile only, and the founder confirms the
 * result as their own input; that confirmation is recorded.
 *
 * C4 — every source is primary: website, uploaded documents and public
 * research all feed the same synthesis. Generation proceeds on whatever is
 * available rather than failing when one source is thin.
 */

const UPLOAD_CATEGORIES = [
  { key: 'company_presentation', label: 'Company Presentation' },
  { key: 'financial_model', label: 'Financial Model' },
  { key: 'annual_report', label: 'Annual Report / Financial Statements' },
  { key: 'other', label: 'Other Documents' },
];

const ACCEPTED = '.pdf,.docx,.doc,.ppt,.pptx,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.zip';

export default function OnboardingForm({ companyId, dealId, onSubmitted }) {
  const { toast, error: toastError } = useToast();
  const { copy } = useConfig();

  const [countries, setCountries] = useState([]);
  const [website, setWebsite] = useState('');
  const [country, setCountry] = useState('');
  const [founders, setFounders] = useState([
    { name: '', linkedinUrl: '', isFullTime: true, selfConfirmed: false },
  ]);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState({});

  useEffect(() => {
    configApi.countries()
      .then((r) => setCountries(r.items || []))
      .catch(() => setCountries([]));
  }, []);

  const setFounder = (i, patch) => setFounders((list) =>
    list.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const addFounder = () => setFounders((l) => [
    ...l, { name: '', linkedinUrl: '', isFullTime: true, selfConfirmed: false },
  ]);

  const removeFounder = (i) => setFounders((l) =>
    (l.length === 1 ? l : l.filter((_, idx) => idx !== i)));

  function onPick(e, category) {
    const picked = [...e.target.files].map((file) => ({ file, category }));
    setFiles((f) => [...f, ...picked]);
    e.target.value = '';
  }

  function validate() {
    const next = {};
    if (!website.trim()) next.website = 'A company website is required.';
    else if (!/^https?:\/\/.+\..+/i.test(website.trim())
             && !/^[\w-]+\.[\w.-]+/.test(website.trim())) {
      next.website = 'Enter a valid website, e.g. https://acme.com';
    }
    if (!country) next.country = 'Headquarters country is required.';
    // C3: LinkedIn is optional — but if a URL is given it must be confirmed.
    founders.forEach((f, i) => {
      if (f.linkedinUrl.trim() && !f.selfConfirmed) {
        next[`founder_${i}`] = 'Please confirm this is your own input.';
      }
    });
    setErrs(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      // Upload first, so documents are available to the generation job.
      // Route through the company-scoped Document Center endpoint (not the
      // deal-scoped materials endpoint): it persists a ProfileDocument under
      // the chosen category — so the file shows up in the Document Center
      // after generation — AND registers the same material for the AI
      // pipeline. Fixes the case where onboarding uploads vanished from the
      // Document Center. Failures are reported but never block generation (C4).
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

      const url = website.trim().startsWith('http')
        ? website.trim() : `https://${website.trim()}`;

      const res = await profileApi.onboard(companyId, {
        websiteUrl: url,
        hqCountry: country,
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
      onSubmitted?.(res);
    } catch (ex) {
      setErrs(ex.fields || {});
      toastError(ex);
    } finally { setBusy(false); }
  }

  return (
    <form className="card onboard-card" onSubmit={submit}>
      <div className="panel-title">
        <div className="row">
          <span className="doc-tile-illo"><Illo name="telescope" size={44} /></span>
          <h2 style={{ margin: 0 }}>Tell us about your company</h2>
        </div>
      </div>
      <p className="hint" style={{ marginBottom: 18 }}>
        We'll build your company profile from your website, anything you upload
        and public sources. You can edit every part of it afterwards.
      </p>

      <label className="field">
        <span>Company website *</span>
        <input
          type="text"
          value={website}
          placeholder="https://acme.com"
          onChange={(e) => setWebsite(e.target.value)}
          autoFocus
        />
        {errs.website && <span className="field-error">{errs.website}</span>}
      </label>

      <label className="field">
        <span>Headquarters country *</span>
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Select a country…</option>
          {countries.map((c) => (
            <option key={c.iso2} value={c.iso2}>{c.name}</option>
          ))}
        </select>
        {errs.country && <span className="field-error">{errs.country}</span>}
        {country && (
          <span className="hint">
            Amounts will be recorded in{' '}
            {countries.find((c) => c.iso2 === country)?.homeCurrency || 'USD'} and
            shown in US$ alongside.
          </span>
        )}
      </label>

      <fieldset className="field-group">
        <legend>Founders</legend>
        <p className="hint" style={{ marginTop: -4, marginBottom: 12 }}>
          LinkedIn is optional. If you add a profile URL we'll use the public
          information on it to pre-fill the founder details, which you can then
          edit.
        </p>
        {founders.map((f, i) => (
          <div key={i} className="founder-row">
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <label className="field" style={{ flex: 1, marginBottom: 8 }}>
                <span>Name</span>
                <input
                  type="text"
                  value={f.name}
                  placeholder="Full name"
                  onChange={(e) => setFounder(i, { name: e.target.value })}
                />
              </label>
              <label className="field" style={{ flex: 1.4, marginBottom: 8 }}>
                <span>LinkedIn profile</span>
                <input
                  type="text"
                  value={f.linkedinUrl}
                  placeholder="https://linkedin.com/in/…"
                  onChange={(e) => setFounder(i, { linkedinUrl: e.target.value })}
                />
              </label>
              {founders.length > 1 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 24 }}
                  onClick={() => removeFounder(i)}
                  aria-label="Remove founder"
                >
                  Remove
                </button>
              )}
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={f.isFullTime}
                onChange={(e) => setFounder(i, { isFullTime: e.target.checked })}
              />
              <span>Working on this full-time</span>
            </label>

            {/* C3 — explicit confirmation when a LinkedIn URL is supplied. */}
            {f.linkedinUrl.trim() && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={f.selfConfirmed}
                  onChange={(e) => setFounder(i, { selfConfirmed: e.target.checked })}
                />
                <span>
                  {copy('profile.linkedin.confirm',
                    'I confirm I have reviewed this information and provide it as my own input.')}
                </span>
              </label>
            )}
            {errs[`founder_${i}`] && (
              <span className="field-error">{errs[`founder_${i}`]}</span>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" onClick={addFounder}>
          + Add Founder
        </button>
      </fieldset>

      <fieldset className="field-group">
        <legend>Existing documents</legend>
        <p className="hint" style={{ marginTop: -4, marginBottom: 12 }}>
          Anything you already have helps — a deck, your model, financial
          statements. PDF, Word, PowerPoint, Excel, CSV, images or ZIP.
        </p>
        <div className="upload-grid">
          {UPLOAD_CATEGORIES.map((cat) => (
            <label key={cat.key} className="upload-tile">
              <input
                type="file"
                multiple
                accept={ACCEPTED}
                onChange={(e) => onPick(e, cat.key)}
                style={{ display: 'none' }}
              />
              <span className="upload-tile-label">{cat.label}</span>
              <span className="hint">
                {files.filter((f) => f.category === cat.key).length || 'No'} file(s)
              </span>
            </label>
          ))}
        </div>
        {files.length > 0 && (
          <ul className="file-list">
            {files.map((f, i) => (
              <li key={i}>
                <span>{f.file.name}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setFiles((l) => l.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <div className="step-nav">
        <span className="hint">
          You can add or change anything after the profile is generated.
        </span>
        <button className="btn btn-primary" disabled={busy}>
          {busy && <span className="spin" style={{ borderTopColor: '#fff' }} />}
          Generate Company Profile
        </button>
      </div>
    </form>
  );
}
