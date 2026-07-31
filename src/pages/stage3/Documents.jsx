import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDeal } from '../../context/DealContext';
import { useConfig } from '../../context/ConfigContext';
import { useToast, useConfirm } from '../../context/AppContext';
import { stage3 as api } from '../../api/endpoints';
import { useArtifact } from '../../lib/artifact';
import { openDownload } from '../../lib/download';
import { Stage3Gate, DOC_FLOW } from './Stage3';
import {
  AiBadge, Banner, GeneratePanel, Pill, SkeletonCard, StepNav,
} from '../../components/ui';
import { fmtNumber, titleCase } from '../../lib/format';

export default function Stage3Doc() {
  const { doc } = useParams();
  const { dealId } = useDeal();
  const { stageLabel } = useConfig();
  const navigate = useNavigate();
  const idx = DOC_FLOW.findIndex((d) => d.key === doc);
  const meta = DOC_FLOW[idx];

  const goHub = () => navigate(`/deals/${dealId}/stage/3`);
  const goNext = idx >= 0 && idx < DOC_FLOW.length - 1
    ? () => navigate(`/deals/${dealId}/stage/3/${DOC_FLOW[idx + 1].key}`)
    : null;

  if (!meta) { goHub(); return null; }

  const props = { onBack: goHub, onNext: goNext, nextLabel: goNext ? `Continue to ${DOC_FLOW[idx + 1].title}` : undefined };

  return (
    <>
      <div className="eyebrow">Stage 3 · {stageLabel(3)} · step {idx + 1} of {DOC_FLOW.length}</div>
      <h1>{meta.title}</h1>
      <p className="section-note">{meta.blurb}</p>
      {doc === 'story' && <StoryDoc {...props} />}
      {doc === 'teaser' && <TeaserDoc {...props} />}
      {doc === 'deck' && <DeckDoc {...props} />}
      {doc === 'model' && <ModelDoc {...props} />}
      {doc === 'im' && <ImDoc {...props} />}
      {doc === 'review' && <ReviewDoc {...props} />}
    </>
  );
}

/** Shared: wraps a document flow with the Stage-3 hard-gate handling. */
function withGate(artifact, dealId) {
  // CR-02 / C6 — an outstanding prerequisite explains itself on the page;
  // it never replaces it. The founder can still read what exists here.
  if (artifact.error?.isGate) {
    return (
      <>
        <Stage3Gate dealId={dealId} />
        <p className="hint" style={{ marginTop: 12 }}>
          Nothing has been generated for this document yet.
        </p>
      </>
    );
  }
  return null;
}

/* ------------------------- S3.2 — Investment Story ------------------------- */
function StoryDoc({ onBack, onNext, nextLabel }) {
  const { dealId } = useDeal();
  const { toast, error: toastError } = useToast();
  const story = useArtifact(() => api.story(dealId), [dealId]);
  const [positioning, setPositioning] = useState(null);
  const [approving, setApproving] = useState(false);

  const gate = withGate(story, dealId);
  if (gate) return gate;

  function gen() {
    story.generate(() => api.generateStory(dealId), {
      onDone: () => toast('Investment story drafted — review each component.'),
      onError: (e) => e.isGate ? story.reload() : toastError(e),
    });
  }

  async function approve() {
    setApproving(true);
    try {
      await api.approveStory(dealId, positioning);
      toast('Story approved — it now governs every document.');
      story.reload({ silent: true });
    } catch (e) { toastError(e); }
    finally { setApproving(false); }
  }

  if (story.loading) return <SkeletonCard lines={5} />;

  if (!story.data) {
    return (
      <>
        <GeneratePanel
          illo="pen"
          title="Draft your investment story"
          explainer="Vision, problem, solution, why now, market, business model, advantage, traction, growth, the opportunity and the exit — one evidence-based narrative aligned to your approved strategy, built before any document."
          cta="Generate investment story"
          onGenerate={gen}
          generating={story.generating}
          progressLines={['Reading your strategy and knowledge base…', 'Structuring the narrative arc…', 'Writing positioning alternatives…']}
        />
        <StepNav onBack={onBack} backLabel="Back to workspace" />
      </>
    );
  }

  const s = story.data;
  const approved = s.status === 'approved';

  return (
    <>
      <div className="card">
        <div className="panel-title">
          <div className="row">
            <h2 style={{ margin: 0 }}>Story v{s.versionNo}</h2>
            <Pill value={s.status} />
          </div>
          <div className="row">
            <AiBadge needsReview={!approved} />
            <button className="btn btn-secondary btn-sm" onClick={gen} disabled={story.generating}>↻ Regenerate</button>
          </div>
        </div>
        {s.thesisPrimary && (<><div className="eyebrow">Primary investment thesis</div><p>{s.thesisPrimary}</p></>)}
        {(s.components || []).map((c) => (
          <div key={c.component} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <div className="spread">
              <strong>{titleCase(c.component)}</strong>
              {c.editedByFounder && <Pill value="approved">Founder edited</Pill>}
            </div>
            <p style={{ margin: '4px 0 0' }}>{c.content}</p>
            {(c.evidence || []).length > 0 && <p className="hint" style={{ fontSize: 11.5 }}>Evidence: {c.evidence.join(', ')}</p>}
          </div>
        ))}
      </div>

      {(s.positioningOptions || []).length > 0 && (
        <div className="card">
          <h3>Choose your positioning</h3>
          <p className="hint">Short, memorable, investor-focused framings — pick the one that fits.</p>
          <div className="stack">
            {s.positioningOptions.map((p) => (
              <button key={p.id} type="button" onClick={() => setPositioning(p.id)}
                className="dim-card" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', borderColor: positioning === p.id ? 'var(--green-600)' : undefined, borderWidth: positioning === p.id ? 2 : 1 }}>
                <strong>{p.text}</strong>
                {p.rationale && <p className="hint" style={{ margin: '4px 0 0' }}>{p.rationale}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {(s.messageBlocks || []).length > 0 && (
        <div className="card">
          <h3>Messaging library</h3>
          <p className="hint">Reusable blocks — intro, elevator pitch, overviews — used again in outreach.</p>
          {s.messageBlocks.map((b, i) => (
            <div key={i} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <div className="eyebrow">{titleCase(b.blockType)}</div>
              <p style={{ margin: 0 }}>{b.content}</p>
            </div>
          ))}
        </div>
      )}

      {!approved && (
        <div className="card">
          <h3>Approve the story</h3>
          <p className="hint">One approved story per workspace — changes after approval flag every dependent document for review.</p>
          <button className="btn btn-primary" onClick={approve} disabled={approving}>
            {approving && <span className="spin" style={{ borderTopColor: '#fff' }} />} Approve story
          </button>
        </div>
      )}

      <StepNav onBack={onBack} backLabel="Back to workspace" onNext={onNext} nextLabel={nextLabel} />
    </>
  );
}

/* ------------------------- S3.3 — Executive Teaser ------------------------- */
const TEASER_TEMPLATES = ['classic_institutional', 'modern_startup', 'technology', 'healthcare', 'manufacturing', 'consumer'];
const TEASER_LENGTHS = [['one', 'One page'], ['three', 'Three pages'], ['five', 'Five pages']];

function TeaserDoc({ onBack, onNext, nextLabel }) {
  const { dealId } = useDeal();
  const { toast, error: toastError } = useToast();
  const teaser = useArtifact(() => api.teaser(dealId), [dealId]);
  const [opts, setOpts] = useState({ templateCode: 'classic_institutional', length: 'one' });

  const gate = withGate(teaser, dealId);
  if (gate) return gate;

  function gen() {
    teaser.generate(() => api.generateTeaser(dealId, opts), {
      onDone: () => toast('Teaser drafted.'),
      onError: toastError,
    });
  }

  async function doExport(format) {
    try { openDownload(await api.exportTeaser(dealId, format)); }
    catch (e) { toastError(e); }
  }

  if (teaser.loading) return <SkeletonCard lines={5} />;

  const picker = (
    <div className="card">
      <h3>{teaser.data ? 'Regenerate with different choices' : 'Design choices'}</h3>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0, maxWidth: 240 }}><span>Template</span>
          <select value={opts.templateCode} onChange={(e) => setOpts({ ...opts, templateCode: e.target.value })}>
            {TEASER_TEMPLATES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0, maxWidth: 180 }}><span>Length</span>
          <select value={opts.length} onChange={(e) => setOpts({ ...opts, length: e.target.value })}>
            {TEASER_LENGTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" onClick={gen} disabled={teaser.generating}>
          {teaser.generating && <span className="spin" style={{ borderTopColor: '#fff' }} />}
          {teaser.data ? '↻ Regenerate teaser' : 'Generate teaser'}
        </button>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        Always generated from the latest approved strategy; each generation is a new version — your
        earlier versions are never overwritten.
      </p>
    </div>
  );

  if (!teaser.data) {
    return (
      <>
        {picker}
        {teaser.generating && (
          <GeneratePanel illo="envelope" generating progressLines={['Assembling the teaser context…', 'Writing the headline and thesis…', 'Drafting every section…']} />
        )}
        <StepNav onBack={onBack} backLabel="Back to workspace" />
      </>
    );
  }

  const t = teaser.data;
  return (
    <>
      {picker}
      <div className="card">
        <div className="panel-title">
          <AiBadge needsReview />
          <div className="row">
            <button className="btn btn-secondary btn-sm" onClick={() => doExport('pdf')}>Export PDF</button>
            <button className="btn btn-secondary btn-sm" onClick={() => doExport('pptx')}>PPTX</button>
            <button className="btn btn-secondary btn-sm" onClick={() => doExport('docx')}>Word</button>
          </div>
        </div>
        {t.headline && <h2 style={{ fontSize: 24 }}>{t.headline}</h2>}
        {t.thesis && <p style={{ fontSize: 15.5 }}>{t.thesis}</p>}
        {t.tagline && <p className="hint" style={{ fontStyle: 'italic' }}>{t.tagline}</p>}
        {(t.sections || []).filter((s) => s.included !== false && !s.isHidden).map((s) => (
          <div key={s.sectionKey} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
            <div className="spread">
              <h3 style={{ margin: 0 }}>{s.title || titleCase(s.sectionKey)}</h3>
              {s.isMandatory && <Pill value="ready">Mandatory</Pill>}
            </div>
            <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{s.body}</p>
          </div>
        ))}
      </div>
      <StepNav onBack={onBack} backLabel="Back to workspace" onNext={onNext} nextLabel={nextLabel} />
    </>
  );
}

/* ------------------------ S3.4 — Pitch Deck (two-step) ------------------------ */
const DECK_TEMPLATES = ['seed', 'series_a', 'growth', 'deeptech', 'enterprise_saas', 'consumer'];

function DeckDoc({ onBack, onNext, nextLabel }) {
  const { dealId } = useDeal();
  const { toast, error: toastError } = useToast();
  const outline = useArtifact(() => api.deckOutline(dealId), [dealId]);
  const slides = useArtifact(() => api.slides(dealId), [dealId]);
  const [opts, setOpts] = useState({ templateCode: 'seed', length: 12 });
  const [busy, setBusy] = useState(false);

  const gate = withGate(outline, dealId);
  if (gate) return gate;

  async function genOutline() {
    setBusy(true);
    try {
      await api.deckOutlineGenerate(dealId, opts);
      toast('Deck outline drafted — review the narrative order.');
      await outline.reload({ silent: true });
      await slides.reload({ silent: true });
    } catch (e) { toastError(e); }
    finally { setBusy(false); }
  }

  async function approveOutline() {
    setBusy(true);
    try {
      await api.approveOutline(dealId);
      toast('Outline approved — slides can now be generated.');
      await outline.reload({ silent: true });
    } catch (e) { toastError(e); }
    finally { setBusy(false); }
  }

  async function genSlides() {
    setBusy(true);
    try {
      await api.generateSlides(dealId);
      toast('Slides generated.');
      await slides.reload({ silent: true });
    } catch (e) {
      if (e.isGate) toastError('Approve the outline first — slides are gated until the narrative order is approved.');
      else toastError(e);
    } finally { setBusy(false); }
  }

  async function doExport(format) {
    try { openDownload(await api.exportDeck(dealId, format)); } catch (e) { toastError(e); }
  }

  if (outline.loading) return <SkeletonCard lines={5} />;

  const o = outline.data;
  const slideList = slides.data?.slides || [];
  const outlineApproved = !!(o?.outlineApproved || slides.data?.outlineApproved);

  return (
    <>
      <div className="card">
        <h3>Step 1 — Narrative outline</h3>
        <p className="hint">FundOS builds the story sequence first (Vision → Problem → … → Ask). Approve the order before slides are generated.</p>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="field" style={{ marginBottom: 0, maxWidth: 220 }}><span>Template</span>
            <select value={opts.templateCode} onChange={(e) => setOpts({ ...opts, templateCode: e.target.value })}>
              {DECK_TEMPLATES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0, maxWidth: 140 }}><span>Slides</span>
            <select value={opts.length} onChange={(e) => setOpts({ ...opts, length: Number(e.target.value) })}>
              {[10, 12, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={genOutline} disabled={busy}>
            {busy && <span className="spin" style={{ borderTopColor: '#fff' }} />}
            {o ? '↻ Regenerate outline' : 'Generate outline'}
          </button>
        </div>

        {o && (
          <>
            <ol style={{ margin: '16px 0 10px', paddingLeft: 22 }}>
              {(o.narrativeOutline || []).map((n) => (
                <li key={n.key || n.title} style={{ padding: '4px 0' }}>
                  <strong>{n.title || titleCase(n.key)}</strong>
                </li>
              ))}
            </ol>
            {outlineApproved
              ? <Pill value="approved">Outline approved</Pill>
              : <button className="btn btn-secondary" onClick={approveOutline} disabled={busy}>Approve outline order</button>}
          </>
        )}
      </div>

      <div className="card">
        <div className="panel-title">
          <h3>Step 2 — Slides</h3>
          {slideList.length > 0 && (
            <div className="row">
              <button className="btn btn-secondary btn-sm" onClick={() => doExport('pptx')}>Export PPTX</button>
              <button className="btn btn-secondary btn-sm" onClick={() => doExport('pdf')}>PDF</button>
              <button className="btn btn-secondary btn-sm" onClick={() => doExport('notes')}>Speaker notes</button>
            </div>
          )}
        </div>
        {!outlineApproved && <Banner kind="amber">Slides unlock when the outline is approved — that keeps the story ahead of the visuals.</Banner>}
        {outlineApproved && slideList.length === 0 && (
          <button className="btn btn-primary" onClick={genSlides} disabled={busy}>
            {busy && <span className="spin" style={{ borderTopColor: '#fff' }} />} Generate slides from the approved outline
          </button>
        )}
        {slideList.length > 0 && (
          <>
            <div className="row" style={{ marginBottom: 10 }}>
              <AiBadge needsReview />
              <button className="btn btn-secondary btn-sm" onClick={genSlides} disabled={busy}>↻ Regenerate slides</button>
            </div>
            <div className="grid2">
              {slideList.map((s, i) => (
                <div key={s.slideId || i} className="dim-card">
                  <div className="eyebrow">Slide {i + 1} · {titleCase(s.slideType)}</div>
                  <strong>{s.headline}</strong>
                  {s.narrative && <p className="hint" style={{ margin: '6px 0' }}>{s.narrative}</p>}
                  {s.keyMetrics && Object.keys(s.keyMetrics).length > 0 && (
                    <p className="hint" style={{ fontSize: 12 }}>
                      {Object.entries(s.keyMetrics).map(([k, v]) => `${titleCase(k)}: ${v}`).join(' · ')}
                    </p>
                  )}
                  {s.investorTakeaway && <p className="hint" style={{ color: 'var(--green-800)' }}>Takeaway: {s.investorTakeaway}</p>}
                  {s.speakerNotes && <details><summary className="hint" style={{ cursor: 'pointer' }}>Speaker notes</summary><p className="hint">{s.speakerNotes}</p></details>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <StepNav onBack={onBack} backLabel="Back to workspace" onNext={onNext} nextLabel={nextLabel} />
    </>
  );
}

/* --------------------------- S3.5 — Financial Model --------------------------- */
function ModelDoc({ onBack, onNext, nextLabel }) {
  const { dealId } = useDeal();
  const { toast, error: toastError } = useToast();
  const model = useArtifact(() => api.modelStatements(dealId), [dealId]);
  const [assumptions, setAssumptions] = useState(null);
  const [horizon, setHorizon] = useState(36);
  const [tab, setTab] = useState('pnl');
  const [impact, setImpact] = useState('');

  useEffect(() => {
    if (model.data) api.modelAssumptions(dealId).then((r) => setAssumptions(r.items || [])).catch(() => setAssumptions([]));
  }, [model.data, dealId]);

  const gate = withGate(model, dealId);
  if (gate) return gate;

  function gen() {
    model.generate(() => api.generateModel(dealId, { horizonMonths: Number(horizon) }), {
      onDone: () => toast('Financial model built — the math is deterministic and balanced by construction.'),
      onError: toastError,
    });
  }

  async function editAssumption(a, value) {
    try {
      const res = await api.patchAssumption(dealId, { group: a.group, key: a.key, value: Number(value) });
      setImpact(res.impactExplanation || 'Model recomputed with the new assumption.');
      toast('Assumption updated — model recomputed.');
      model.reload({ silent: true });
      api.modelAssumptions(dealId).then((r) => setAssumptions(r.items || [])).catch(() => {});
    } catch (e) { toastError(e); }
  }

  async function doExport(format) {
    try { openDownload(await api.exportModel(dealId, format)); } catch (e) { toastError(e); }
  }

  if (model.loading) return <SkeletonCard lines={5} />;

  if (!model.data) {
    return (
      <>
        <div className="card">
          <h3>Build your model</h3>
          <p className="hint">
            An investor-grade, linked three-statement model — P&L, balance sheet and cash flow, monthly —
            generated from your knowledge base and peers. The numbers come from a deterministic engine;
            AI proposes assumptions and explains the results.
          </p>
          <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="field" style={{ marginBottom: 0, maxWidth: 160 }}><span>Horizon (months)</span>
              <select value={horizon} onChange={(e) => setHorizon(e.target.value)}>
                {[24, 36, 48, 60].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button className="btn btn-primary" onClick={gen} disabled={model.generating}>
              {model.generating && <span className="spin" style={{ borderTopColor: '#fff' }} />} Generate model
            </button>
          </div>
          {model.generating && <p className="hint" style={{ marginTop: 10 }}>Linking the three statements…</p>}
        </div>
        <StepNav onBack={onBack} backLabel="Back to workspace" />
      </>
    );
  }

  const m = model.data;
  // BUG-020: the API keys statement lines as "pl."/"cf."/"bs." — the tabs
  // previously filtered on "pnl."/"cashflow."/"balance." and matched
  // nothing, so all three statements rendered empty despite full data.
  const TAB_PREFIXES = { pnl: ['pl.', 'pnl.'], cashflow: ['cf.', 'cashflow.'], balance: ['bs.', 'balance.'] };
  const prefixes = TAB_PREFIXES[tab] || [`${tab}.`];
  const lines = Object.entries(m.lines || {})
    .filter(([k]) => prefixes.some((p) => k.startsWith(p)));
  const months = Math.max(0, ...lines.map(([, vals]) => vals.length));
  const cols = Math.min(months, 12); // first 12 months shown; export for the rest

  return (
    <>
      <div className="card">
        <div className="panel-title">
          <div className="row">
            <h2 style={{ margin: 0 }}>Model v{m.versionNo || 1}</h2>
            {m.balanced !== false && <Pill value="ready">Balanced</Pill>}
          </div>
          <div className="row">
            <button className="btn btn-secondary btn-sm" onClick={() => doExport('xlsx')}>Export XLSX (live formulas)</button>
            <button className="btn btn-secondary btn-sm" onClick={() => doExport('csv')}>CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={() => doExport('pdf')}>PDF</button>
            <button className="btn btn-secondary btn-sm" onClick={gen} disabled={model.generating}>↻ Regenerate</button>
          </div>
        </div>

        <div className="chips" style={{ marginBottom: 12 }}>
          {[['pnl', 'P&L'], ['cashflow', 'Cash Flow'], ['balance', 'Balance Sheet']].map(([k, l]) => (
            <button key={k} type="button" className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Line</th>
                {Array.from({ length: cols }).map((_, i) => <th key={i} className="num">M{i + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              {lines.map(([key, vals]) => (
                <tr key={key}>
                  <td><strong>{titleCase(key.split('.').slice(1).join('.'))}</strong></td>
                  {Array.from({ length: cols }).map((_, i) => (
                    <td key={i} className="num">{vals[i] != null ? fmtNumber(vals[i]) : '—'}</td>
                  ))}
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={cols + 1} className="hint">No lines in this statement yet.</td></tr>}
            </tbody>
          </table>
        </div>
        {months > cols && <p className="hint" style={{ marginTop: 8 }}>Showing the first {cols} of {months} months — export XLSX for the full horizon.</p>}
      </div>

      {m.kpis && Object.keys(m.kpis).length > 0 && (
        <div className="card">
          <h3>KPI dashboard</h3>
          <div className="grid3">
            {Object.entries(m.kpis).map(([k, series]) => {
              const latest = Array.isArray(series) ? series[series.length - 1] : series;
              return (
                <div key={k} className="dim-card">
                  <div className="eyebrow">{titleCase(k)}</div>
                  <div className="money-range" style={{ fontSize: 20 }}>{fmtNumber(latest)}</div>
                  <p className="hint" style={{ margin: 0 }}>latest month</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Assumptions — edit and see the impact</h3>
        <p className="hint">Changing an assumption recomputes the model deterministically and creates a new version; AI explains what moved.</p>
        {impact && <Banner kind="green">{impact}</Banner>}
        {assumptions === null ? <SkeletonCard /> : (
          <table className="data">
            <thead><tr><th>Group</th><th>Assumption</th><th className="num">Value</th><th /></tr></thead>
            <tbody>
              {assumptions.map((a) => <AssumptionRow key={`${a.group}.${a.key}`} a={a} onSave={editAssumption} />)}
              {assumptions.length === 0 && <tr><td colSpan={4} className="hint">No editable assumptions returned yet.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <StepNav onBack={onBack} backLabel="Back to workspace" onNext={onNext} nextLabel={nextLabel} />
    </>
  );
}

function AssumptionRow({ a, onSave }) {
  const [val, setVal] = useState(a.value ?? '');
  useEffect(() => setVal(a.value ?? ''), [a.value]);
  const dirty = String(val) !== String(a.value ?? '');
  return (
    <tr>
      <td>{titleCase(a.group)}</td>
      <td>{titleCase(a.key)} {a.source && <span className="hint">({a.source})</span>}</td>
      <td className="num">
        <input type="number" step="any" value={val} onChange={(e) => setVal(e.target.value)} style={{ maxWidth: 130, textAlign: 'right' }} />
        {a.unit && <span className="hint" style={{ marginLeft: 6 }}>{a.unit}</span>}
      </td>
      <td style={{ textAlign: 'right' }}>
        <button className="btn btn-sm btn-primary" disabled={!dirty} onClick={() => onSave(a, val)}>Apply</button>
      </td>
    </tr>
  );
}

/* ----------------------- S3.6 — Investment Memorandum ----------------------- */
const IM_TEMPLATES = ['institutional_vc', 'growth_equity', 'private_equity', 'family_office', 'strategic'];

function ImDoc({ onBack, onNext, nextLabel }) {
  const { dealId } = useDeal();
  const { toast, error: toastError } = useToast();
  const im = useArtifact(() => api.im(dealId), [dealId]);
  const [template, setTemplate] = useState('institutional_vc');

  const gate = withGate(im, dealId);
  if (gate) return gate;

  function gen() {
    im.generate(() => api.generateIm(dealId, { templateCode: template }), {
      onDone: () => toast('Investment memorandum drafted.'),
      onError: toastError,
    });
  }

  async function doExport(format) {
    try { openDownload(await api.exportIm(dealId, format)); } catch (e) { toastError(e); }
  }

  if (im.loading) return <SkeletonCard lines={5} />;

  const picker = (
    <div className="card">
      <h3>{im.data ? 'Regenerate for a different audience' : 'Choose the investor audience'}</h3>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0, maxWidth: 240 }}><span>Template</span>
          <select value={template} onChange={(e) => setTemplate(e.target.value)}>
            {IM_TEMPLATES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" onClick={gen} disabled={im.generating}>
          {im.generating && <span className="spin" style={{ borderTopColor: '#fff' }} />}
          {im.data ? '↻ Regenerate IM' : 'Generate IM'}
        </button>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        Each section is generated from your approved information and stays consistent with the model
        and story; the tone adapts to the audience without changing facts.
      </p>
    </div>
  );

  if (!im.data) {
    return (
      <>
        {picker}
        {im.generating && <GeneratePanel illo="memo" generating progressLines={['Structuring the memorandum…', 'Writing each section from approved facts…']} />}
        <StepNav onBack={onBack} backLabel="Back to workspace" />
      </>
    );
  }

  const d = im.data;
  return (
    <>
      {picker}
      <div className="card">
        <div className="panel-title">
          <div className="row"><h2 style={{ margin: 0 }}>IM v{d.versionNo || 1}</h2><AiBadge needsReview /></div>
          <div className="row">
            <button className="btn btn-secondary btn-sm" onClick={() => doExport('pdf')}>Export PDF</button>
            <button className="btn btn-secondary btn-sm" onClick={() => doExport('docx')}>Word</button>
            <button className="btn btn-secondary btn-sm" onClick={() => doExport('watermarked')}>Watermarked</button>
          </div>
        </div>
        {(d.sections || []).map((s, i) => (
          <div key={s.sectionKey || i} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
            <h3 style={{ margin: 0 }}>{i + 1}. {s.title || titleCase(s.sectionKey)}</h3>
            <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{s.body}</p>
          </div>
        ))}
      </div>
      <StepNav onBack={onBack} backLabel="Back to workspace" onNext={onNext} nextLabel={nextLabel} />
    </>
  );
}

/* ------------------ S3.7 — AI review, inconsistencies, package ------------------ */
function ReviewDoc({ onBack }) {
  const { dealId } = useDeal();
  const { toast, error: toastError } = useToast();
  const confirm = useConfirm();
  const review = useArtifact(() => api.review(dealId), [dealId]);
  const [pkg, setPkg] = useState(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    api.package(dealId).then(setPkg).catch(() => {});
  }, [dealId]);

  const gate = withGate(review, dealId);
  if (gate) return gate;

  function run() {
    review.generate(() => api.runReview(dealId), {
      onDone: () => toast('Investor-readiness review complete.'),
      onError: toastError,
    });
  }

  async function approvePackage() {
    const incs = review.data?.inconsistencies?.length ? review.data.inconsistencies : (review.data?.crossDocInconsistencies || []);
    const openIssues = incs.filter((i) => !i.resolved);
    if (openIssues.length) {
      const stale = review.data?.staleDocuments || [];
      toastError(stale.length
        ? `${openIssues.length} cross-document inconsistenc${openIssues.length === 1 ? 'y is' : 'ies are'} unresolved — approval is blocked. ${stale.join(', ')} ${stale.length === 1 ? 'is' : 'are'} out of date with the knowledge base: regenerate ${stale.length === 1 ? 'it' : 'them'}, re-run the review, then approve.`
        : `${openIssues.length} cross-document inconsistenc${openIssues.length === 1 ? 'y is' : 'ies are'} unresolved — approval is blocked. Fix the source facts, regenerate the affected documents, and re-run the review.`);
      return;
    }
    if (!(await confirm({
      title: 'Freeze investor package?',
      message: 'Approved packages cannot be modified — material changes require a new version.',
      confirmLabel: 'Freeze package',
    }))) return;
    setApproving(true);
    try {
      const res = await api.approvePackage(dealId);
      setPkg(res);
      toast('Investor package approved and frozen — you are ready for investor discovery.');
    } catch (e) {
      if (e.status === 409) toastError(e.detail || 'A mandatory document isn’t ready or high-priority inconsistencies remain.');
      else toastError(e);
    } finally { setApproving(false); }
  }

  async function report() {
    try { openDownload(await api.reviewReport(dealId)); } catch (e) { toastError(e); }
  }

  if (review.loading) return <SkeletonCard lines={5} />;

  if (!review.data) {
    return (
      <>
        <GeneratePanel
          illo="magnifier"
          title="Would a banker send this package tomorrow?"
          explainer="The final quality gate reviews the whole package — story, teaser, deck, model, IM — for quality, cross-document consistency, and the objections investors are likely to raise."
          cta="Run investor-readiness review"
          onGenerate={run}
          generating={review.generating}
          progressLines={['Reading every document…', 'Cross-checking facts between documents…', 'Simulating investor objections…']}
        />
        <StepNav onBack={onBack} backLabel="Back to workspace" />
      </>
    );
  }

  const r = review.data;
  // BUG-021: the API serves findings/crossDocInconsistencies (and now also
  // qualityScore/categoryScores + aliases). Read both shapes so no review
  // content is ever silently dropped.
  const recommendations = r.recommendations?.length ? r.recommendations : (r.findings || []);
  const inconsistencies = r.inconsistencies?.length ? r.inconsistencies : (r.crossDocInconsistencies || []);
  const categoryNotes = r.categoryNotes && typeof r.categoryNotes === 'object' ? r.categoryNotes : {};
  const staleDocs = r.staleDocuments || [];
  return (
    <>
      {staleDocs.length > 0 && (
        <div className="banner banner-amber" style={{ marginBottom: 14 }}>
          ⚠ Out of date with their inputs: <strong>{staleDocs.join(', ')}</strong>.
          Regenerate {staleDocs.length === 1 ? 'it' : 'them'}, then run the review again —
          the comparisons below may reflect stale figures until you do.
        </div>
      )}
      {pkg?.status === 'approved' && (
        <Banner kind="green">
          Investor package v{pkg.versionNo} is approved and frozen — the baseline for investor discovery.
        </Banner>
      )}

      <div className="card">
        <div className="panel-title">
          <div className="score-dial">
            <span className="big">{Math.round(r.qualityScore ?? 0)}</span>
            <span>
              <div className="eyebrow">Quality score / 100</div>
              <AiBadge />
              {r.scoringBasis && <div className="hint" style={{ maxWidth: 320, fontSize: 11 }}>{r.scoringBasis}</div>}
            </span>
          </div>
          <div className="row">
            <button className="btn btn-secondary btn-sm" onClick={report}>Download review PDF</button>
            <button className="btn btn-secondary btn-sm" onClick={run} disabled={review.generating}>↻ Re-run review</button>
          </div>
        </div>
        {r.categoryScores && (
          <div style={{ marginTop: 10 }}>
            {Object.entries(r.categoryScores).map(([k, v]) => (
              <div key={k} className="band-row">
                <span>{titleCase(k)}</span>
                <div className="band-track"><div className="band-fill" style={{ left: 0, width: `${Math.min(100, v)}%` }} /></div>
                <span className="hint num">{Math.round(v)}/100</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {recommendations.length > 0 && (
        <div className="card">
          <h3>Prioritised recommendations</h3>
          {recommendations.map((rec, i) => (
            <div key={rec.id || i} className="spread" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <span>
                <strong>{rec.reason || rec.text}</strong>
                {rec.category && <span className="hint" style={{ marginLeft: 8 }}>{titleCase(rec.category)}</span>}
                {rec.businessImpact && <div className="hint">{rec.businessImpact}</div>}
              </span>
              {rec.priority && <Pill value={rec.priority}>{rec.priority} priority</Pill>}
            </div>
          ))}
        </div>
      )}

      {inconsistencies.length > 0 && (
        <div className="card">
          <h3>Cross-document inconsistencies</h3>
          <p className="hint">The same fact told differently across documents — deterministic comparisons; fix at the source (usually the knowledge base) and regenerate. Unresolved items block package approval.</p>
          {inconsistencies.map((inc, i) => (
            <div key={inc.id || i} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <div className="spread">
                <strong>{titleCase(inc.fieldKey || 'Fact')}</strong>
                {inc.priority && <Pill value={inc.priority} />}
              </div>
              {(inc.values || []).map((v, j) => (
                <p key={j} className="hint" style={{ margin: '2px 0' }}>{titleCase(v.document)}: {String(v.value)}</p>
              ))}
              {inc.recommendedCorrection && <p className="hint" style={{ color: 'var(--green-800)' }}>Suggested fix: {inc.recommendedCorrection}</p>}
            </div>
          ))}
        </div>
      )}

      {Object.keys(categoryNotes).length > 0 && (
        <div className="card">
          <h3>Category notes</h3>
          {Object.entries(categoryNotes).map(([cat, note]) => (
            <div key={cat} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <div className="spread">
                <strong>{titleCase(cat)}</strong>
                {r.categoryScores?.[cat] != null && <Pill value="ready">{Math.round(r.categoryScores[cat])}/100</Pill>}
              </div>
              <p className="hint" style={{ margin: '4px 0 0' }}>{typeof note === 'string' ? note : JSON.stringify(note)}</p>
            </div>
          ))}
        </div>
      )}

      {((r.riskSummary || []).length > 0 || (r.outstandingActions || []).length > 0) && (
        <div className="card">
          <h3>Risks & outstanding actions</h3>
          {(r.riskSummary || []).map((x, i) => (
            <p key={`rs${i}`} className="hint" style={{ color: 'var(--amber-600)' }}>⚠ {typeof x === 'string' ? x : x.text || JSON.stringify(x)}</p>
          ))}
          {(r.outstandingActions || []).map((x, i) => (
            <p key={`oa${i}`} className="hint">→ {typeof x === 'string' ? x : x.text || JSON.stringify(x)}</p>
          ))}
        </div>
      )}

      {(r.objections || []).length > 0 && (
        <div className="card">
          <h3>Investor objection simulator</h3>
          <p className="hint">Questions investors are likely to ask — with the reason, evidence and a suggested response, so you walk in prepared.</p>
          {r.objections.map((o, i) => (
            <details key={i} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                {o.question} {o.priority && <Pill value={o.priority} />}
              </summary>
              {o.reason && <p className="hint" style={{ marginTop: 6 }}>Why they’ll ask: {o.reason}</p>}
              {o.suggestedResponse && <p style={{ margin: '4px 0' }}><strong>Suggested response:</strong> {o.suggestedResponse}</p>}
              {o.evidence && <p className="hint">Evidence: {Array.isArray(o.evidence) ? o.evidence.join(', ') : o.evidence}</p>}
            </details>
          ))}
        </div>
      )}

      {pkg?.status !== 'approved' && (
        <div className="card">
          <h3>Approve the investor package</h3>
          <p className="hint">
            Freezes the current versions of every document as the baseline for investor discovery.
            Blocked if a mandatory document isn’t ready or high-priority inconsistencies remain.
          </p>
          <button className="btn btn-primary" onClick={approvePackage} disabled={approving}>
            {approving && <span className="spin" style={{ borderTopColor: '#fff' }} />} Approve Investor Package & Continue
          </button>
        </div>
      )}

      <StepNav onBack={onBack} backLabel="Back to workspace"
        extra={<Link className="btn btn-secondary" to={`/deals/${dealId}`}>Back to deal home</Link>} />
    </>
  );
}
