import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { profile as profileApi } from '../../api/endpoints';
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

  const sections = useMemo(() => data?.sections || [], [data]);
  const needsOnboarding = data && data.status === 'draft' && !data.lastGeneratedAt;

  if (loading && !data) return <SkeletonCard />;

  if (needsOnboarding) {
    return (
      <>
        <div className="eyebrow">Stage 1 · Company Profile</div>
        <h1>{data.companyName}</h1>
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
          <h1 style={{ marginBottom: 4 }}>{data.companyName}</h1>
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

function ProfileStatus({ data, companyId, onChange }) {
  const { toast, error: toastError } = useToast();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function confirm() {
    setBusy(true);
    try {
      await profileApi.confirmReview(companyId);
      toast('Profile marked as reviewed.');
      await onChange({ silent: true });
    } catch (e) { toastError(e); }
    finally { setBusy(false); }
  }

  return (
    <div className="profile-status card">
      <div className="spread" style={{ marginBottom: 8 }}>
        <strong>Completeness</strong>
        <span>{Math.round(data.completenessPct || 0)}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${data.completenessPct || 0}%` }} />
      </div>
      {/* C2 — complete means mandatory sections filled AND review confirmed. */}
      {data.isComplete ? (
        <p className="hint" style={{ marginTop: 10 }}>
          ✓ Reviewed {data.reviewedAt ? fmtDate(data.reviewedAt) : ''}
        </p>
      ) : (
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 10, width: '100%' }}
          onClick={confirm}
          disabled={busy}
        >
          Confirm I've reviewed this
        </button>
      )}
      <button
        className="btn btn-primary btn-sm"
        style={{ marginTop: 8, width: '100%' }}
        onClick={() => navigate(`/companies/${companyId}/strategy`)}
      >
        Continue to Fundraising Strategy →
      </button>
    </div>
  );
}

/** One section. Uniform behaviour across all of them. */
function Section({ companyId, section, profileData, onChanged }) {
  const { toast, error: toastError } = useToast();
  const { copy } = useConfig();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content || '');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null);

  useEffect(() => { setDraft(section.content || ''); }, [section.content]);

  async function save() {
    setBusy(true);
    try {
      await profileApi.saveSection(companyId, section.sectionKey, { content: draft });
      toast(`${section.label} saved.`);
      setEditing(false);
      await onChanged();
    } catch (e) { toastError(e); }
    finally { setBusy(false); }
  }

  async function regenerate(force = false) {
    setBusy(true);
    try {
      const res = await profileApi.regenerateSection(companyId, section.sectionKey, force);
      if (res?.status === 'confirm_required') {
        // Never silently discard a human edit.
        const ok = await confirm({
          title: 'Regenerate this section?',
          message: `${res.message}\n\nRegenerate anyway?`,
          confirmLabel: 'Regenerate',
          tone: 'danger',
        });
        if (ok) return regenerate(true);
        return;
      }
      toast(`${section.label} regenerated.`);
      await onChanged();
    } catch (e) { toastError(e); }
    finally { setBusy(false); }
  }

  async function loadHistory() {
    try {
      const res = await profileApi.sectionHistory(companyId, section.sectionKey);
      setHistory(res.items || []);
    } catch (e) { toastError(e); }
  }

  // Structured sections render their own editors.
  if (section.sectionKey === 'founders') {
    return (
      <FoundersSection
        companyId={companyId}
        founders={profileData.founders || []}
        section={section}
        onChanged={onChanged}
      />
    );
  }
  if (section.kind === 'list') {
    return <RecordListSection companyId={companyId} section={section}
                              profileData={profileData} onChanged={onChanged} />;
  }
  // Numeric/structured forms (Revenue Model, Company Metrics, Financial
  // Summary) render a validated table editor rather than a prose box.
  if (section.kind === 'structured' && STRUCTURED_SCHEMAS[section.sectionKey]) {
    return <StructuredFormSection companyId={companyId} section={section}
                                  onChanged={onChanged} />;
  }
  if (section.sectionKey === 'document_center') {
    return <DocumentCenter companyId={companyId} section={section}
                           profileData={profileData} onChanged={onChanged} />;
  }

  return (
    <section className="card profile-section" id={`sec-${section.sectionKey}`}>
      <div className="panel-title">
        <h2 style={{ margin: 0 }}>{section.label}</h2>
        <div className="row">
          {section.source === 'ai_research' && !section.editedByUser && <AiBadge />}
          {section.requiredForCompleteness && !section.content && (
            <Pill value="pending">Required</Pill>
          )}
        </div>
      </div>

      {section.needsInput && !section.content && (
        <p className="hint empty-note">
          {copy('profile.section.unavailable',
            "We couldn't find enough information for this section. Add details directly, or upload a document that covers it.")}
        </p>
      )}

      {editing ? (
        <>
          <textarea
            className="section-editor"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(6, Math.ceil((draft || '').length / 90))}
          />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
              {busy && <span className="spin" style={{ borderTopColor: '#fff' }} />}
              Save
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setDraft(section.content || ''); setEditing(false); }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          {section.content
            ? <div className="section-content">{section.content}</div>
            : <p className="hint">Nothing here yet.</p>}
          <div className="row section-actions">
            {section.isEditable && (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            {section.isRegenerable && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => regenerate(false)}
                disabled={busy}
              >
                {busy && <span className="spin" />}
                Regenerate with AI
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => (history ? setHistory(null) : loadHistory())}
            >
              {history ? 'Hide history' : `History (v${section.versionNo})`}
            </button>
          </div>
        </>
      )}

      {history && (
        <div className="history-list">
          {history.length === 0 && <p className="hint">No earlier versions.</p>}
          {history.map((h) => (
            <div key={h.versionNo} className="history-row">
              <div className="spread">
                <strong>v{h.versionNo}</strong>
                <span className="hint">
                  {h.changeSummary} · {fmtDate(h.changedAt)}
                  {h.changedBy ? ` · ${h.changedBy}` : ''}
                </span>
              </div>
              <p className="hint history-excerpt">{(h.content || '').slice(0, 260)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
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

  return (
    <section className="card profile-section" id={`sec-${section.sectionKey}`}>
      <div className="panel-title">
        <h2 style={{ margin: 0 }}>{section.label}</h2>
        <button className="btn btn-secondary btn-sm" onClick={add} disabled={busy}>
          + Add Founder
        </button>
      </div>
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
    </section>
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
    <section className="card profile-section" id={`sec-${section.sectionKey}`}>
      <div className="panel-title">
        <h2 style={{ margin: 0 }}>{section.label}</h2>
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
    </section>
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
    <section className="card profile-section" id={`sec-${section.sectionKey}`}>
      <div className="panel-title">
        <h2 style={{ margin: 0 }}>{section.label}</h2>
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
    </section>
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
    <section className="card profile-section" id={`sec-${section.sectionKey}`}>
      <h2 style={{ marginTop: 0 }}>{section.label}</h2>

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
    </section>
  );
}
