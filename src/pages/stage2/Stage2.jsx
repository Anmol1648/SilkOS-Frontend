import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDeal } from '../../context/DealContext';
import { useToast, useConfirm } from '../../context/AppContext';
import { stage2 as api } from '../../api/endpoints';
import { useArtifact } from '../../lib/artifact';
import { openDownload } from '../../lib/download';
import {
  AiBadge, Banner, GeneratePanel, MoneyRange, Pill, SkeletonCard, StepFlow, StepNav,
} from '../../components/ui';
import { fmtMoney, fmtPct, moneyValue, titleCase, usdValue } from '../../lib/format';
import { Illo } from '../../components/illos';
import PrereqPanel from '../../components/PrereqPanel';
import CashRunwayStep from './CashRunwayStep';
import FundraiseBuckets from './FundraiseBuckets';
import DealTargetsForm from './DealTargetsForm';
import { useConfig } from '../../context/ConfigContext';

// PRD §6 — cash position now sits between objectives and peers.
const STEPS = ['Objectives', 'Cash & Runway', 'Peers', 'Ideal Raise',
  'Valuation', 'Instrument & Dilution', 'Approve'];
const SEBI_NOTE = 'Indicative range for discussion only — not a valuation opinion or investment advice. SEBI/FEMA advisory notes apply; consult your advisors.';

export default function Stage2() {
  const [params, setParams] = useSearchParams();
  const step = Math.min(6, Math.max(0, Number(params.get('step') || 0)));
  const setStep = (i) => setParams({ step: String(i) });
  const navigate = useNavigate();
  const { dealId, refreshPlan } = useDeal();
  // Stage 2 renders under either /companies/:companyId/strategy or the
  // legacy /deals/:dealId/stage/2 path, so resolve whichever is present.
  const { companyId: routeCompanyId } = useParams();
  const { context } = useDeal();
  const companyId = routeCompanyId || context?.companyId;
  const [bucketNo, setBucketNo] = useState(null);
  const [desiredRunway, setDesiredRunway] = useState(18);

  return (
    <>
      <div className="eyebrow">Stage 2 · Fundraising Strategy</div>
      <h1>Your board-ready fundraising strategy</h1>
      <p className="section-note">
        Your objectives and cash position steer the peer benchmark, the ideal raise, the
        indicative valuation and the instrument comparison — consolidated into a blueprint
        you approve as the governing <strong>Strategy Profile</strong>.
      </p>

      {/* C6 — advisory only. The page always renders; nothing is blocked. */}
      <PrereqPanel stageNo={2} companyId={companyId} dealId={dealId} />

      <StepFlow steps={STEPS} current={step} onStep={setStep} doneUpTo={step - 1} />
      {step === 0 && (
        <>
          <ObjectivesStep onNext={() => setStep(1)} />
          {/* C6 — the guided sequence is advisory. A founder who already
              knows their terms can enter them and skip straight ahead. */}
          {companyId && (
            <details className="skip-strategy">
              <summary>Already know your numbers? Enter them directly</summary>
              <DealTargetsForm
                companyId={companyId}
                dealId={dealId}
                onSaved={async () => {
                  await refreshPlan();
                }}
              />
            </details>
          )}
        </>
      )}
      {step === 1 && (
        <>
          <CashRunwayStep companyId={companyId} desiredRunwayMonths={desiredRunway} />
          <StepNav onBack={() => setStep(0)} onNext={() => setStep(2)}
            nextLabel="Continue to peers" />
        </>
      )}
      {step === 2 && <PeersStep onBack={() => setStep(1)} onNext={() => setStep(3)} />}
      {step === 3 && (
        <>
          {companyId && (
            <FundraiseBuckets companyId={companyId} value={bucketNo}
              onChange={setBucketNo} />
          )}
          <RaiseStep onBack={() => setStep(2)} onNext={() => setStep(4)} />
        </>
      )}
      {step === 4 && <ValuationStep onBack={() => setStep(3)} onNext={() => setStep(5)} />}
      {step === 5 && <InstrumentsStep onBack={() => setStep(4)} onNext={() => setStep(6)} />}
      {step === 6 && companyId && (
        <DealTargetsForm companyId={companyId} dealId={dealId} compact
          onSaved={async () => { await refreshPlan(); }} />
      )}
      {step === 6 && (
        <ApproveStep
          onBack={() => setStep(5)}
          onApproved={async () => {
            await refreshPlan();
            navigate(dealId ? `/deals/${dealId}/stage/3` : '/dashboard');
          }}
        />
      )}
    </>
  );
}

/* ----------------------------- S2.1 — Objectives ----------------------------- */
const PURPOSES = ['working_capital', 'product_dev', 'hiring', 'intl_expansion', 'sales_marketing', 'acquisitions', 'general_corporate'];
const TIMELINES = [['immediate', 'Immediate'], ['3m', 'Within 3 months'], ['6m', 'Within 6 months'], ['12m', 'Within 12 months']];
const RUNWAYS = [['12m', '12 months'], ['18m', '18 months'], ['24m', '24 months'], ['36m', '36 months']];
const INVESTOR_TYPES = ['angels', 'accelerators', 'family_offices', 'micro_vc', 'seed_vc', 'vc', 'growth', 'strategic'];
const GEOS = ['india', 'sea', 'mena', 'us', 'europe', 'global'];

function ObjectivesStep({ onNext }) {
  const { dealId } = useDeal();
  const { toast, error: toastError } = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ purposes: [], timeline: '', runway: '', preferredInvestorTypes: [], geographies: [], maxDilutionPct: 18 });
  const [existing, setExisting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.objectives(dealId)
      .then((o) => {
        setForm((f) => ({
          ...f,
          purposes: o.purposes || [],
          timeline: o.timeline || '',
          runway: o.runway || '',
          preferredInvestorTypes: o.preferredInvestorTypes || [],
          geographies: o.geographies || [],
          maxDilutionPct: o.maxDilutionPct ?? 18,
        }));
        setExisting(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dealId]);

  const toggle = (key, v) => setForm((f) => ({
    ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v],
  }));

  function validate() {
    const e = {};
    if (!form.purposes.length) e.purposes = 'Select at least one purpose.';
    if (!form.timeline) e.timeline = 'Choose a timeline.';
    if (!form.runway) e.runway = 'Choose a desired runway.';
    const d = Number(form.maxDilutionPct);
    if (Number.isNaN(d) || d < 1 || d > 50) e.maxDilutionPct = 'Between 1 and 50%.';
    setErrs(e);
    return !Object.keys(e).length;
  }

  async function save() {
    if (!validate()) return;
    if (existing && !(await confirm({
      title: 'Regenerate downstream outputs?',
      message: 'Changing objectives marks downstream strategy outputs for regeneration. Continue?',
      confirmLabel: 'Continue', tone: 'danger',
    }))) return;
    setBusy(true);
    try {
      await api.saveObjectives(dealId, { ...form, maxDilutionPct: Number(form.maxDilutionPct) });
      toast('Objectives saved.');
      onNext();
    } catch (ex) { setErrs(ex.fields || {}); toastError(ex); }
    finally { setBusy(false); }
  }

  if (loading) return <SkeletonCard lines={4} />;

  return (
    <>
      <div className="card">
        <h2>What are you raising for?</h2>
        <p className="hint">No recommendations are shown until your objectives are captured — they steer every engine.</p>

        <label className="field"><span>Purpose of raise * (choose all that apply)</span>
          <div className="chips">
            {PURPOSES.map((p) => (
              <button key={p} type="button" className={`chip ${form.purposes.includes(p) ? 'on' : ''}`} onClick={() => toggle('purposes', p)}>{titleCase(p)}</button>
            ))}
          </div>
          {errs.purposes && <span className="field-error">{errs.purposes}</span>}
        </label>

        <div className="grid2">
          <label className="field"><span>Timeline *</span>
            <select value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })}>
              <option value="">Choose…</option>
              {TIMELINES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {errs.timeline && <span className="field-error">{errs.timeline}</span>}
          </label>
          <label className="field"><span>Desired runway *</span>
            <select value={form.runway} onChange={(e) => setForm({ ...form, runway: e.target.value })}>
              <option value="">Choose…</option>
              {RUNWAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {errs.runway && <span className="field-error">{errs.runway}</span>}
          </label>
        </div>

        <label className="field"><span>Preferred investor types (optional)</span>
          <div className="chips">
            {INVESTOR_TYPES.map((t) => (
              <button key={t} type="button" className={`chip ${form.preferredInvestorTypes.includes(t) ? 'on' : ''}`} onClick={() => toggle('preferredInvestorTypes', t)}>{titleCase(t)}</button>
            ))}
          </div>
        </label>

        <label className="field"><span>Geographic preference (optional)</span>
          <div className="chips">
            {GEOS.map((g) => (
              <button key={g} type="button" className={`chip ${form.geographies.includes(g) ? 'on' : ''}`} onClick={() => toggle('geographies', g)}>{titleCase(g)}</button>
            ))}
          </div>
        </label>

        <label className="field" style={{ maxWidth: 260 }}><span>Maximum acceptable dilution (%) — advisory</span>
          <input type="number" min={1} max={50} value={form.maxDilutionPct}
            onChange={(e) => setForm({ ...form, maxDilutionPct: e.target.value })} />
          {errs.maxDilutionPct && <span className="field-error">{errs.maxDilutionPct}</span>}
        </label>
      </div>
      <StepNav onNext={save} nextLabel="Save objectives and continue" nextDisabled={busy} />
    </>
  );
}

/* -------------------------- S2.2 — Peer benchmarking -------------------------- */
function PeersStep({ onBack, onNext }) {
  const { dealId } = useDeal();
  const { toast, error: toastError } = useToast();
  const peers = useArtifact(() => api.peers(dealId), [dealId]);
  const [addName, setAddName] = useState('');
  const [detail, setDetail] = useState(null);

  function gen() {
    peers.generate(() => api.generatePeers(dealId), {
      onDone: () => toast('Peer universe ready.'),
      onError: toastError,
    });
  }

  async function curate(body, okMsg) {
    try {
      await api.curatePeer(dealId, body);
      toast(okMsg);
      // BUG-011: reflect the change immediately; a short follow-up reload
      // covers any read-after-write lag so the list never looks stale.
      await peers.reload({ silent: true });
      setTimeout(() => peers.reload({ silent: true }), 1200);
    } catch (e) {
      if (e.status === 409) toastError(e.detail || 'At least 3 comparable peers must remain — add a replacement first.');
      else toastError(e);
    }
  }

  async function openDetail(pid) {
    try { setDetail(await api.peerDetail(dealId, pid)); } catch (e) { toastError(e); }
  }

  if (peers.loading) return <SkeletonCard lines={5} />;

  if (!peers.data) {
    return (
      <>
        <GeneratePanel
          illo="constellation"
          title="Find your comparable companies"
          explainer="Silk identifies peers across sector, business model, revenue stage, growth, geography and more — each with an explainable, weighted similarity score. Typically 10–30 seconds."
          cta="Generate peer universe"
          onGenerate={gen}
          generating={peers.generating}
          progressLines={['Comparing business models…', 'Scoring similarity dimensions…', 'Grouping close, aspirational and market-leader peers…']}
        />
        <StepNav onBack={onBack} />
      </>
    );
  }

  const list = peers.data.peers || [];
  const groups = { A: [], B: [], C: [] };
  list.forEach((p) => (groups[p.group || p.groupCode || 'A'] || groups.A).push(p));
  const GROUP_LABELS = { A: 'Closest comparables — benchmarking', B: 'Aspirational — 24–48 month horizon', C: 'Market leaders — multiples & trends only' };

  return (
    <>
      {peers.data.status === 'pending_recalc' && (
        <Banner kind="amber" action={<button className="btn btn-sm btn-primary" onClick={gen}>Regenerate</button>}>
          Inputs changed — regenerate the peer universe to bring it current.
        </Banner>
      )}
      <div className="spread" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Peer universe <span className="hint">v{peers.data.versionNo}</span></h2>
        <button className="btn btn-secondary btn-sm" onClick={gen} disabled={peers.generating}>↻ Regenerate</button>
      </div>

      {['A', 'B', 'C'].map((g) => (groups[g].length > 0 || g === 'A') && (
        <div key={g} className="card">
          <div className="eyebrow">Group {g}</div>
          <h3>{GROUP_LABELS[g]}</h3>
          {groups[g].map((p) => {
            const pid = p.peerId || p.id;
            return (
            <div key={pid} className="spread" style={{ padding: '9px 0', borderTop: '1px solid var(--line)' }}>
              <span>
                <strong>{p.name}</strong>
                {p.sector && <span className="hint" style={{ marginLeft: 8 }}>{p.sector}</span>}
                {(p.selectionRationale || p.rationale) && <div className="hint">{p.selectionRationale || p.rationale}</div>}
                {p.similarityBreakdown && (
                  <div className="hint" style={{ fontSize: 11.5 }}>
                    {Object.entries(p.similarityBreakdown)
                      .map(([k, v]) => `${titleCase(k)} ${fmtBreakdown(v)}`)
                      .join(' · ')}
                  </div>
                )}
              </span>
              <span className="row">
                {p.similarityScore != null && <Pill value="ready">{Math.round(p.similarityScore)}% match</Pill>}
                <button className="btn btn-ghost btn-sm" onClick={() => openDetail(pid)} disabled={!pid}>Journey</button>
                <button className="btn btn-danger btn-sm" onClick={() => curate({ action: 'remove', peerId: pid }, `${p.name} removed — benchmarks will recalculate.`)} disabled={!pid}>Remove</button>
              </span>
            </div>
          ); })}
          {g === 'A' && groups[g].length === 0 && <p className="hint">No close comparables yet.</p>}
        </div>
      ))}

      <div className="card">
        <h3>Add a peer you know</h3>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input type="text" placeholder="Company name" value={addName} onChange={(e) => setAddName(e.target.value)} style={{ maxWidth: 280 }} />
          <button className="btn btn-secondary" disabled={!addName.trim()}
            onClick={() => { curate({ action: 'add', name: addName.trim(), group: 'A' }, `${addName.trim()} added — benchmarks will recalculate.`); setAddName(''); }}>
            Add peer
          </button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Adding or removing a peer recalculates benchmark statistics, valuation and the raise recommendation.</p>
      </div>

      {(peers.data.insights || []).length > 0 && (
        <div className="card">
          <div className="panel-title"><h3>Benchmark insights</h3><AiBadge /></div>
          {peers.data.insights.map((ins, i) => (
            <p key={i}>
              {ins.kind && <Pill value={ins.kind} />} <span style={{ marginLeft: 6 }}>{ins.text || String(ins)}</span>
              {ins.evidence && <span className="hint" style={{ display: 'block' }}>Evidence: {Array.isArray(ins.evidence) ? ins.evidence.join(', ') : ins.evidence}</span>}
            </p>
          ))}
        </div>
      )}

      {detail && (
        <div className="card" style={{ borderColor: 'var(--green-600)' }}>
          <div className="spread">
            <h3>{detail.peer?.name || detail.name || 'Peer'} — company journey</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>Close</button>
          </div>
          {(detail.milestones || []).length === 0 && <p className="hint">No journey data available for this peer.</p>}
          {(detail.milestones || []).map((m, i) => (
            <div key={i} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <strong>{m.round || m.label || `Milestone ${i + 1}`}</strong>
              <span className="hint" style={{ marginLeft: 8 }}>{m.date}</span>
              <div className="hint">
                {[(m.capitalRaised || m.amountRaised) && `Raised ${fmtMoney(m.capitalRaised || m.amountRaised)}`, m.valuation && `Valuation ${fmtMoney(m.valuation)}`, m.revenue && `Revenue ${fmtMoney(m.revenue)}`, m.employees && `${m.employees} employees`, m.leadInvestor && `Lead: ${m.leadInvestor}`].filter(Boolean).join(' · ')}
              </div>
              {m.notes && <div className="hint">{m.notes}</div>}
            </div>
          ))}
          {(detail.insights || []).map((ins, i) => (
            <p key={i} style={{ marginTop: 8 }}><Pill value={ins.kind || 'inference'} /> {ins.text}</p>
          ))}
        </div>
      )}

      <StepNav onBack={onBack} onNext={onNext} nextLabel="Continue to ideal raise"
        extra={<button className="btn btn-secondary" onClick={() => curate({ action: 'approve' }, 'Peer universe approved.')}>Approve universe</button>} />
    </>
  );
}

/* ----------------------------- S2.3 — Ideal raise ----------------------------- */
function RaiseStep({ onBack, onNext }) {
  const { dealId } = useDeal();
  const { toast, error: toastError } = useToast();
  const raise = useArtifact(() => api.raise(dealId), [dealId]);

  function gen() {
    raise.generate(() => api.generateRaise(dealId), {
      onDone: () => toast('Raise recommendation ready.'),
      onError: (e) => {
        if (e.status === 422 && e.fields?.objectives) toastError('Capture your objectives first (step 1).');
        else toastError(e);
      },
    });
  }

  async function pickScenario(id) {
    try { await api.selectScenario(dealId, id); toast('Scenario selected.'); raise.reload({ silent: true }); }
    catch (e) { toastError(e); }
  }

  if (raise.loading) return <SkeletonCard lines={5} />;

  if (!raise.data) {
    return (
      <>
        <GeneratePanel
          illo="rocket"
          title="How much should you raise?"
          explainer="Silk recommends the smallest amount that reaches your next value-inflection milestone with acceptable runway and ownership — raise enough, not as much as possible. Always a range, never a guarantee."
          cta="Generate raise recommendation"
          onGenerate={gen}
          generating={raise.generating}
          progressLines={['Reading your metrics and objectives…', 'Benchmarking against your peers…', 'Sizing the raise across six dimensions…']}
        />
        <StepNav onBack={onBack} />
      </>
    );
  }

  const r = raise.data;
  return (
    <>
      {r.status === 'pending_recalc' && (
        <Banner kind="amber" action={<button className="btn btn-sm btn-primary" onClick={gen}>Regenerate</button>}>
          Inputs changed — regenerate the recommendation.
        </Banner>
      )}
      <div className="card">
        <div className="panel-title">
          <div>
            <div className="eyebrow">Recommended raise · {titleCase(r.fundingBand || '')} band</div>
            <div className="money-range" style={{ fontSize: 28 }}>{fmtMoney(r.recommended)}</div>
          </div>
          <div className="row">
            <AiBadge />
            <button className="btn btn-secondary btn-sm" onClick={gen} disabled={raise.generating}>↻ Regenerate</button>
          </div>
        </div>
        <div className="grid3" style={{ marginTop: 6 }}>
          <MoneyRange label="Range" low={r.range?.low} high={r.range?.high} />
          <div>
            <div className="eyebrow">Expected dilution</div>
            <div className="money-range">{fmtPct(r.dilutionRangePct?.[0])} – {fmtPct(r.dilutionRangePct?.[1])}</div>
          </div>
          <div>
            <div className="eyebrow">Confidence · timeline</div>
            <div className="row"><Pill value={r.confidence} /> <span>{r.recommendedTimeline}</span></div>
          </div>
        </div>
        {r.narrative && <p style={{ marginTop: 14 }}>{r.narrative}</p>}
        <div className="disclaimer">Amounts are recommendations with reasoning, never guarantees; dilution is shown only as a range.</div>
      </div>

      {r.dimensionScores && (
        <div className="card">
          <h3>Why this size — six dimensions</h3>
          {Object.entries(r.dimensionScores).map(([k, v]) => (
            <div key={k} className="band-row">
              <span>{titleCase(k)}</span>
              <div className="band-track"><div className="band-fill" style={{ left: 0, width: `${Math.min(100, v)}%` }} /></div>
              <span className="hint num">{Math.round(v)}/100</span>
            </div>
          ))}
          {(r.reasoning || []).map((line, i) => <p key={i} className="hint" style={{ marginTop: i === 0 ? 12 : 4 }}>• {line}</p>)}
          {(r.risks || []).map((line, i) => <p key={i} className="hint" style={{ color: 'var(--amber-600)' }}>⚠ {line}</p>)}
        </div>
      )}

      {(r.scenarios || []).length > 0 && (
        <div className="card">
          <h3>Choose your scenario</h3>
          <p className="hint">Three ways to run this raise — compare and select the one that fits your appetite.</p>
          <div className="grid3">
            {r.scenarios.map((s) => (
              <button key={s.id} type="button" onClick={() => pickScenario(s.id)}
                className="dim-card" style={{ textAlign: 'left', cursor: 'pointer', borderColor: s.isSelected ? 'var(--green-600)' : undefined, borderWidth: s.isSelected ? 2 : 1 }}>
                <div className="spread"><strong>{s.label}</strong>{s.isSelected && <Pill value="approved">Selected</Pill>}</div>
                <div className="money-range" style={{ fontSize: 18 }}>{fmtMoney(s.raise)}</div>
                <p className="hint" style={{ margin: '4px 0' }}>{fmtPct(s.dilutionPct)} dilution · {s.runwayMonths} mo runway</p>
                <p className="hint">{s.assessment}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <StepNav onBack={onBack} onNext={onNext} nextLabel="Continue to valuation" />
    </>
  );
}

/* -------------------- S2.4 — Valuation (football field) -------------------- */
function ValuationStep({ onBack, onNext }) {
  const { dealId, context } = useDeal();
  const companyId = context?.companyId;
  const { toast, error: toastError } = useToast();
  const val = useArtifact(() => api.valuation(dealId), [dealId]);
  const [blocked, setBlocked] = useState(null); // 'financials' | 'raise'

  function gen() {
    setBlocked(null);
    val.generate(() => api.generateValuation(dealId), {
      onDone: () => toast('Indicative valuation ready.'),
      onError: (e) => {
        if (e.status === 422 && e.fields?.valuation === 'needs_financials') setBlocked('financials');
        else if (e.status === 409) setBlocked('raise');
        else toastError(e);
      },
    });
  }

  if (val.loading) return <SkeletonCard lines={5} />;

  if (blocked === 'financials') {
    return (
      <>
        <div className="gate-panel">
          <span className="illo-wrap"><Illo name="ledger" size={104} /></span>
          <h3>Add your financials first</h3>
          <p className="hint" style={{ maxWidth: 480, margin: '0 auto 14px' }}>
            A meaningful valuation needs your revenue (or ARR). Enter it in the
            <strong> Financial Summary</strong> section of your Company Profile —
            it syncs automatically to the knowledge base the valuation reads, so
            you only enter it once. Then generate the valuation; we won’t show
            you a zero range.
          </p>
          <Link className="btn btn-primary"
                to={companyId ? `/companies/${companyId}/profile#sec-financial_summary` : '../ckb'}>
            Go to Financial Summary
          </Link>{' '}
          <button className="btn btn-secondary" onClick={gen}>Try again</button>
        </div>
        <StepNav onBack={onBack} />
      </>
    );
  }
  if (blocked === 'raise') {
    return (
      <>
        <Banner kind="amber" action={<button className="btn btn-sm btn-primary" onClick={onBack}>Go to Ideal Raise</button>}>
          Generate the ideal-raise recommendation before the valuation — it anchors the analysis.
        </Banner>
        <StepNav onBack={onBack} />
      </>
    );
  }

  if (!val.data) {
    return (
      <>
        <GeneratePanel
          illo="scales"
          title="What is your company indicatively worth?"
          explainer="Multiple methodologies — revenue multiples, comparables, venture benchmarks and more — combined into a football field with a recommended indicative range. Never a single number; always with assumptions, outliers visible, and an advisory disclaimer."
          cta="Generate indicative valuation"
          onGenerate={gen}
          generating={val.generating}
          progressLines={['Selecting applicable methodologies…', 'Computing each method’s range…', 'Building the football field…']}
        />
        <StepNav onBack={onBack} />
      </>
    );
  }

  const v = val.data;
  const ff = v.footballField || [];
  const maxHigh = Math.max(1, ...ff.map((m) => m.high || 0), moneyValue(v.range?.high));
  const zeroRange = !moneyValue(v.range?.low) && !moneyValue(v.range?.high);

  return (
    <>
      {v.status === 'pending_recalc' && (
        <Banner kind="amber" action={<button className="btn btn-sm btn-primary" onClick={gen}>Regenerate</button>}>
          Inputs changed — regenerate the valuation.
        </Banner>
      )}
      {zeroRange && (
        <Banner kind="red" action={<Link className="btn btn-sm btn-primary"
          to={companyId ? `/companies/${companyId}/profile#sec-financial_summary` : '../ckb'}>Add financials</Link>}>
          The computed range is empty — add revenue/ARR in your Company Profile’s Financial Summary (it syncs to the knowledge base) and regenerate before relying on this.
        </Banner>
      )}
      <div className="card">
        <div className="panel-title">
          <div>
            <div className="eyebrow">Indicative Market Valuation Range</div>
            <div className="money-range" style={{ fontSize: 28 }}>
              {fmtMoney(v.range?.low)} – {fmtMoney(v.range?.high)}
            </div>
          </div>
          <div className="row">
            <Pill value={v.confidence}>{v.confidence} confidence</Pill>
            <AiBadge />
            <button className="btn btn-secondary btn-sm" onClick={gen} disabled={val.generating}>↻ Regenerate</button>
          </div>
        </div>
        {v.positioningStatement && <p>{v.positioningStatement}</p>}
        <div className="disclaimer">{v.disclaimer || SEBI_NOTE}</div>
      </div>

      <div className="card">
        <h3>Football field — every method, outliers visible</h3>
        {ff.map((m, i) => {
          const left = ((m.low || 0) / maxHigh) * 100;
          const width = Math.max(0.5, (((m.high || 0) - (m.low || 0)) / maxHigh) * 100);
          const mid = ((m.mid || 0) / maxHigh) * 100;
          return (
            <div key={i} className="ff-row">
              <span>
                {m.method}
                {!m.applicable && <div className="hint">Not applicable</div>}
                {m.isOutlier && <div className="hint" style={{ color: 'var(--amber-600)' }}>Outlier — {m.outlierReason || 'excluded from the weighting'}</div>}
              </span>
              <div className="ff-track">
                {m.applicable && (m.high || 0) > 0 && (
                  <>
                    <div className={`ff-bar ${m.isOutlier ? 'outlier' : ''}`} style={{ left: `${left}%`, width: `${width}%` }} />
                    {m.mid > 0 && <div className="ff-mid" style={{ left: `${mid}%` }} />}
                  </>
                )}
              </div>
              <span className="hint num">
                {m.applicable && m.high > 0
                  ? `${fmtMoney({ value: m.low, ccy: v.range?.low?.ccy })}–${fmtMoney({ value: m.high, ccy: v.range?.low?.ccy })}`
                  : '—'}
              </span>
            </div>
          );
        })}
        <div className="ff-row" style={{ marginTop: 6 }}>
          <strong>Recommended range</strong>
          <div className="ff-track" style={{ background: 'transparent' }}>
            <div className="ff-rec" style={{
              left: `${(moneyValue(v.range?.low) / maxHigh) * 100}%`,
              width: `${Math.max(1, ((moneyValue(v.range?.high) - moneyValue(v.range?.low)) / maxHigh) * 100)}%`,
            }} />
          </div>
          <span className="hint num" />
        </div>
      </div>

      {((v.assumptions || []).length > 0 || (v.limitations || []).length > 0) && (
        <div className="card">
          <h3>Assumptions & limitations</h3>
          {(v.assumptions || []).map((a, i) => <p key={i} className="hint">• {typeof a === 'string' ? a : JSON.stringify(a)}</p>)}
          {(v.limitations || []).map((a, i) => <p key={`l${i}`} className="hint" style={{ color: 'var(--amber-600)' }}>⚠ {a}</p>)}
        </div>
      )}

      <StepNav onBack={onBack} onNext={onNext} nextLabel="Continue to instrument & dilution" />
    </>
  );
}

/* ------------------- S2.5 — Instruments & dilution simulator ------------------- */
function InstrumentsStep({ onBack, onNext }) {
  const { dealId } = useDeal();
  const { toast, error: toastError } = useToast();
  const [instruments, setInstruments] = useState(null);
  const [disclaimer, setDisclaimer] = useState('');
  const [raiseData, setRaiseData] = useState(null);
  const [valData, setValData] = useState(null);
  const [sim, setSim] = useState(null);
  const [simBusy, setSimBusy] = useState(false);
  const [form, setForm] = useState({ raiseUsd: '', instrument: 'equity' });

  const loadInstruments = () => api.instruments(dealId)
    .then((r) => { setInstruments(r.items || r.instruments || []); setDisclaimer(r.disclaimer || ''); })
    .catch(() => setInstruments([]));

  useEffect(() => {
    loadInstruments();
    api.raise(dealId).then((r) => {
      setRaiseData(r);
      setForm((f) => ({ ...f, raiseUsd: f.raiseUsd || Math.round(usdValue(r.recommended)) }));
    }).catch(() => {});
    api.valuation(dealId).then(setValData).catch(() => {});
  }, [dealId]);

  const [genBusy, setGenBusy] = useState(false);
  // BUG-017: the backend generator existed but the page had no trigger —
  // the options panel sat permanently empty.
  async function generateOptions() {
    setGenBusy(true);
    try {
      await api.generateInstruments(dealId);
      await loadInstruments();
      toast('Instrument options generated — informational only, never advice.');
    } catch (e) {
      if (e.status === 409) toastError(e.detail || 'Generate the raise and valuation first.');
      else toastError(e);
    } finally { setGenBusy(false); }
  }

  async function select(iid) {
    try {
      await api.selectInstrument(dealId, iid);
      toast('Preference recorded (informational only).');
      setInstruments((cur) => cur.map((x) => ({ ...x, isSelected: (x.id || x.instrumentId) === iid })));
    } catch (e) { toastError(e); }
  }

  async function simulate(e) {
    e.preventDefault();
    const lowUsd = usdValue(valData?.range?.low);
    const highUsd = usdValue(valData?.range?.high);
    if (!lowUsd || !highUsd) { toastError('Generate a valuation with a positive range first (previous step).'); return; }
    if (!Number(form.raiseUsd)) { toastError('Enter a raise amount.'); return; }
    setSimBusy(true);
    try {
      const res = await api.simulateDilution(dealId, {
        raiseUsd: Number(form.raiseUsd),
        valuationLowUsd: lowUsd,
        valuationHighUsd: highUsd,
        instrument: form.instrument,
      });
      setSim(res);
    } catch (ex) { toastError(ex); }
    finally { setSimBusy(false); }
  }

  return (
    <>
      <div className="card">
        <h2>Instrument options — information, not advice</h2>
        <p className="hint">Equity, SAFE, CCD and convertible notes compared for your situation. Silk never recommends one — the choice is yours with your advisors.</p>
        {instruments === null ? <SkeletonCard /> : (
          <div className="grid2" style={{ marginTop: 10 }}>
            {instruments.map((ins) => {
              const iid = ins.id || ins.instrumentId;
              return (
                <div key={iid || ins.instrument} className="dim-card" style={{ borderColor: ins.isSelected ? 'var(--green-600)' : undefined }}>
                  <div className="spread">
                    <strong>{titleCase(ins.instrument)}</strong>
                    {ins.isSelected ? <Pill value="approved">Your preference</Pill> : iid && (
                      <button className="btn btn-ghost btn-sm" onClick={() => select(iid)}>Mark preference</button>
                    )}
                  </div>
                  {(ins.pros || []).map((p, i) => <p key={`p${i}`} className="hint" style={{ margin: '4px 0' }}>＋ {p}</p>)}
                  {(ins.cons || []).map((c, i) => <p key={`c${i}`} className="hint" style={{ margin: '4px 0', color: 'var(--amber-600)' }}>－ {c}</p>)}
                  {(ins.mechanics || ins.mechanicsExplainer) && <p className="hint" style={{ marginTop: 6 }}>{ins.mechanics || ins.mechanicsExplainer}</p>}
                </div>
              );
            })}
            {instruments.length === 0 && (
              <div>
                <p className="hint">Compare equity, SAFE, CCD and convertible notes for your round.</p>
                <button className="btn btn-primary" onClick={generateOptions} disabled={genBusy}>
                  {genBusy && <span className="spin" style={{ borderTopColor: '#fff' }} />} Generate instrument options
                </button>
              </div>
            )}
          </div>
        )}
        <div className="disclaimer">{disclaimer || 'Options for consideration, not advice.'}</div>
      </div>

      <div className="card">
        <h3>Dilution simulator</h3>
        <p className="hint">
          Ownership outcomes for raise × your valuation range × instrument — computed deterministically,
          always as bands (never single points). Valuation range in use:{' '}
          <strong>{valData ? `${fmtMoney(valData.range?.low)} – ${fmtMoney(valData.range?.high)}` : '—'}</strong>.
        </p>
        <form className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={simulate}>
          <label className="field" style={{ marginBottom: 0, maxWidth: 200 }}><span>Raise (USD)</span>
            <input type="number" min={0} value={form.raiseUsd} onChange={(e) => setForm({ ...form, raiseUsd: e.target.value })} />
          </label>
          <label className="field" style={{ marginBottom: 0, maxWidth: 200 }}><span>Instrument</span>
            <select value={form.instrument} onChange={(e) => setForm({ ...form, instrument: e.target.value })}>
              {['equity', 'safe', 'ccd', 'convertible_note'].map((i) => <option key={i} value={i}>{titleCase(i)}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" disabled={simBusy}>{simBusy && <span className="spin" style={{ borderTopColor: '#fff' }} />} Simulate</button>
        </form>
        {raiseData && <p className="hint" style={{ marginTop: 8 }}>Prefilled from your recommended raise ({fmtMoney(raiseData.recommended)}).</p>}

        {sim && (
          <div style={{ marginTop: 16 }}>
            {Object.entries(sim.ownershipBands || {}).map(([who, band]) => {
              const [lo, hi] = Array.isArray(band) ? band : [band, band];
              return (
                <div key={who} className="band-row">
                  <span>{titleCase(who)}</span>
                  <div className="band-track">
                    <div className="band-fill" style={{ left: `${lo}%`, width: `${Math.max(1.2, hi - lo)}%` }} />
                  </div>
                  <span className="hint num">{fmtPct(lo, 1)} – {fmtPct(hi, 1)}</span>
                </div>
              );
            })}
            {sim.conversionAssumptions && (
              <p className="hint" style={{ marginTop: 8 }}>
                Conversion assumptions: {typeof sim.conversionAssumptions === 'string' ? sim.conversionAssumptions : JSON.stringify(sim.conversionAssumptions)}
              </p>
            )}
            <div className="disclaimer">Ownership shown as ranges across your valuation band; SAFE/note scenarios model conversion at the range boundaries.</div>
          </div>
        )}
      </div>

      <StepNav onBack={onBack} onNext={onNext} nextLabel="Continue to blueprint" />
    </>
  );
}

/* ---------------------- S2.6 — Blueprint & Strategy approval ---------------------- */
function ApproveStep({ onBack, onApproved }) {
  const { dealId, context } = useDeal();
  const companyId = context?.companyId;
  const { toast, error: toastError } = useToast();
  const { stageLabel } = useConfig();
  const confirm = useConfirm();
  const bp = useArtifact(() => api.blueprint(dealId), [dealId]);
  const [valData, setValData] = useState(null);
  const [instrument, setInstrument] = useState('');
  const [approving, setApproving] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api.valuation(dealId).then(setValData).catch(() => {});
    api.profile(dealId).then(setProfile).catch(() => {});
  }, [dealId]);

  function gen() {
    bp.generate(() => api.generateBlueprint(dealId), {
      onDone: () => toast('Strategy blueprint ready for review.'),
      onError: toastError,
    });
  }

  const zeroVal = valData && !moneyValue(valData.range?.low) && !moneyValue(valData.range?.high);

  async function approve() {
    if (zeroVal) { toastError('The valuation range is empty — add financials and regenerate the valuation before approving.'); return; }
    if (!(await confirm({
      title: 'Approve strategy?',
      message: 'This becomes the immutable Strategy Profile governing the next stage — material changes later require a new approved version.',
      confirmLabel: 'Approve',
    }))) return;
    setApproving(true);
    try {
      const res = await api.approve(dealId, { selectedAlternativeId: null, selectedInstrument: instrument || '' });
      setProfile(res);
      toast(`Strategy approved — ${stageLabel(3)} is now open.`);
    } catch (e) {
      if (e.status === 409) toastError(e.detail || 'An upstream artefact is missing or pending — regenerate the earlier steps first.');
      else toastError(e);
    } finally { setApproving(false); }
  }

  async function report() {
    try { openDownload(await api.strategyReport(dealId)); } catch (e) { toastError(e); }
  }

  if (bp.loading) return <SkeletonCard lines={5} />;

  return (
    <>
      {profile && (
        <div className="card" style={{ borderColor: 'var(--green-600)', borderWidth: 2 }}>
          <div className="panel-title">
            <h2>✓ Strategy Profile v{profile.versionNo} — approved</h2>
            <button className="btn btn-secondary btn-sm" onClick={report}>Download strategy PDF</button>
          </div>
          <div className="grid3">
            <div><div className="eyebrow">Approved raise</div><div className="money-range">{fmtMoney(profile.approvedRaise)}</div></div>
            <MoneyRange label="Valuation range" low={profile.valuationRange?.low} high={profile.valuationRange?.high} />
            <div><div className="eyebrow">Timeline</div><strong>{profile.fundraisingTimeline || '—'}</strong></div>
          </div>
          {profile.preferredInvestorCategories && (
            <div style={{ marginTop: 12 }}>
              <div className="eyebrow">Derived investor categories</div>
              <div className="chips" style={{ marginTop: 6 }}>
                {(profile.preferredInvestorCategories.primary || []).map((c) => <span key={c} className="chip on">{c}</span>)}
                {(profile.preferredInvestorCategories.secondary || []).map((c) => <span key={c} className="chip">{c}</span>)}
                {(profile.preferredInvestorCategories.optional || []).map((c) => <span key={c} className="chip" style={{ opacity: .7 }}>{c}</span>)}
              </div>
            </div>
          )}
          <div className="step-nav">
            <span />
            <button className="btn btn-primary" onClick={onApproved}>Continue to Stage 3: {stageLabel(3)} →</button>
          </div>
        </div>
      )}

      {!profile && !bp.data && (
        <GeneratePanel
          illo="blueprint"
          title="Consolidate everything into your strategy blueprint"
          explainer="One coherent, board-ready plan — executive summary, current position, recommended raise and valuation, why this strategy, risks with mitigations, and the milestones to hit before outreach."
          cta="Generate blueprint"
          onGenerate={gen}
          generating={bp.generating}
          progressLines={['Reading every Stage-2 output…', 'Assessing risks and market conditions…', 'Writing the executive recommendation…']}
        />
      )}

      {!profile && bp.data && (
        <>
          {bp.data.status === 'pending_recalc' && (
            <Banner kind="amber" action={<button className="btn btn-sm btn-primary" onClick={gen}>Regenerate</button>}>
              An earlier step changed — regenerate the blueprint before approving.
            </Banner>
          )}
          {zeroVal && (
            <Banner kind="red" action={<Link className="btn btn-sm btn-primary"
              to={companyId ? `/companies/${companyId}/profile#sec-financial_summary` : '../ckb'}>Add financials</Link>}>
              The valuation range is empty — approval is blocked until a meaningful range exists. Add revenue/ARR in Financial Summary and regenerate the valuation.
            </Banner>
          )}
          <div className="card">
            <div className="panel-title">
              <h2>Strategy blueprint <span className="hint">v{bp.data.versionNo}</span></h2>
              <div className="row">
                <AiBadge needsReview />
                <button className="btn btn-secondary btn-sm" onClick={gen} disabled={bp.generating}>↻ Regenerate</button>
              </div>
            </div>
            {bp.data.executiveSummary && (<><div className="eyebrow">Executive summary</div><p>{asText(bp.data.executiveSummary)}</p></>)}
            {bp.data.currentPosition && (<><div className="eyebrow">Current position</div><p>{asText(bp.data.currentPosition)}</p></>)}
            <div className="grid2">
              {bp.data.recommendedRaise && (<div><div className="eyebrow">Recommended raise</div><p>{fmtMoneyOrRange(bp.data.recommendedRaise)}</p></div>)}
              {bp.data.recommendedValuation && (<div><div className="eyebrow">Recommended valuation</div><p>{fmtMoneyOrRange(bp.data.recommendedValuation)}</p></div>)}
            </div>
            {bp.data.whyThisStrategy && (<><div className="eyebrow">Why this strategy</div><p>{asText(bp.data.whyThisStrategy)}</p></>)}
            {(bp.data.risks || []).length > 0 && (
              <>
                <div className="eyebrow">Risks & mitigations</div>
                {bp.data.risks.map((r, i) => (
                  <p key={i} className="hint">
                    ⚠ <strong>{asText(r.risk || r)}</strong>
                    {r.likelihood && <> — likelihood {asText(r.likelihood)}, impact {asText(r.impact)}.</>}
                    {r.mitigation && <> Mitigation: {asText(r.mitigation)}</>}
                  </p>
                ))}
              </>
            )}
            {(bp.data.successFactors || []).length > 0 && (
              <>
                <div className="eyebrow">Success factors</div>
                {bp.data.successFactors.map((s, i) => <p key={i} className="hint">• {typeof s === 'string' ? s : s.text}</p>)}
              </>
            )}
            {(bp.data.nextMilestones || []).length > 0 && (
              <>
                <div className="eyebrow">Milestones before outreach</div>
                {bp.data.nextMilestones.map((m, i) => <p key={i} className="hint">→ {typeof m === 'string' ? m : m.text}</p>)}
              </>
            )}
          </div>

          <div className="card">
            <h3>Approve strategy & continue</h3>
            <p className="hint">
              Approval locks this as the governing Strategy Profile — the authoritative input for your
              investor materials. Optionally note your instrument preference (informational only).
            </p>
            <label className="field" style={{ maxWidth: 260 }}><span>Instrument preference (optional)</span>
              <select value={instrument} onChange={(e) => setInstrument(e.target.value)}>
                <option value="">No preference</option>
                {['equity', 'safe', 'ccd', 'convertible_note'].map((i) => <option key={i} value={i}>{titleCase(i)}</option>)}
              </select>
            </label>
            <button className="btn btn-primary" onClick={approve} disabled={approving || zeroVal}>
              {approving && <span className="spin" style={{ borderTopColor: '#fff' }} />} Approve Strategy & Continue
            </button>
          </div>
        </>
      )}

      <StepNav onBack={onBack} />
    </>
  );
}


/** BUG-018 defense: any narrative value renders as text, never as a raw
 *  object (which crashes React). {summary: "..."} → the summary. */
function asText(x) {
  if (x == null) return '';
  if (typeof x === 'string' || typeof x === 'number') return String(x);
  if (typeof x === 'object') {
    if (typeof x.summary === 'string') return x.summary;
    if (typeof x.text === 'string') return x.text;
    try { return Object.values(x).filter((v) => typeof v === 'string').join('; ') || JSON.stringify(x); }
    catch { return String(x); }
  }
  return String(x);
}

/** Renders a money object, a {low, high} range, or a plain string. */
function fmtMoneyOrRange(m) {
  if (m == null) return '—';
  if (typeof m === 'string') return m;
  if (m.low != null || m.high != null) return `${fmtMoney(m.low)} – ${fmtMoney(m.high)}`;
  return fmtMoney(m);
}

/** BUG-010: a similarity dimension arrives as {weight, match, contribution}
 *  — show the contribution (already a % of the total score). */
function fmtBreakdown(v) {
  if (v == null) return '—';
  if (typeof v === 'number') return `${Math.round(v)}`;
  if (typeof v === 'object') {
    if (v.contribution != null) return `${Number(v.contribution).toFixed(1)}%`;
    if (v.match != null) return `${Math.round(Number(v.match) * 100)}%`;
    return '—';
  }
  return String(v);
}
