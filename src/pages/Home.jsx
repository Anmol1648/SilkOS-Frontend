import { Link, useNavigate } from 'react-router-dom';
import { useDeal } from '../context/DealContext';
import { useToast, useConfirm } from '../context/AppContext';
import { useConfig } from '../context/ConfigContext';
import { deal as dealApi } from '../api/endpoints';
import { Pill, SkeletonCard } from '../components/ui';
import { titleCase } from '../lib/format';
import { Contours, Illo } from '../components/illos';

// Illustration + one-line blurb per stage. The stage NAME is not hardcoded
// here — it comes from platform config (useConfig().stageLabel) so renaming
// a stage in admin flows through the whole app. Keep the blurbs describing
// what each stage does; keep them consistent with the configured names.
const STAGE_META = {
  1: { illo: 'summit', blurb: 'AI research, your inputs, and existing materials become a verified knowledge base and readiness assessment.' },
  2: { illo: 'scales', blurb: 'Peer benchmark → ideal raise → indicative valuation → instrument options → an approved Strategy Profile.' },
  3: { illo: 'easel', blurb: 'Find and prioritise the investors most likely to fund this round, using your approved strategy.' },
};

export default function Home() {
  const { dealId, masterplan, context, refreshPlan } = useDeal();
  const { toast, error: toastError } = useToast();
  const { stageLabel } = useConfig();
  const confirm = useConfirm();
  const navigate = useNavigate();

  if (!masterplan) return <><SkeletonCard /><SkeletonCard /></>;

  const stages = masterplan.stages || [];
  const built = stages.filter((s) => [1, 2, 3].includes(s.stageNo));
  const next = built.find((s) => s.status === 'in_progress')
    || built.find((s) => s.status === 'available')
    || built.find((s) => s.status !== 'complete');
  const overallPct = built.length
    ? Math.round(built.reduce((a, s) => a + (s.completionPct || 0), 0) / built.length)
    : 0;
  const pending = masterplan.pendingArtifacts || [];

  async function enterStage(s) {
    if (s.status !== 'locked') { navigate(`/deals/${dealId}/stage/${s.stageNo}`); return; }
    if (s.stageNo === 3 && !stageGateMet(stages, 3)) {
      navigate(`/deals/${dealId}/stage/3`); // gate panel explains + links to Stage 2
      return;
    }
    const ok = await confirm({
      title: 'Override stage order?',
      message: `Stage ${s.stageNo} is recommended after the earlier stages. Proceed anyway? The override is recorded.`,
      confirmLabel: 'Proceed',
    });
    if (!ok) return;
    try {
      await dealApi.overrideStage(dealId, s.stageNo);
      toast(`Stage ${s.stageNo} unlocked.`);
      await refreshPlan();
      navigate(`/deals/${dealId}/stage/${s.stageNo}`);
    } catch (e) {
      if (e.isGate) toastError("Some inputs for this stage are still pending — you can continue, but this action needs them.");
      else toastError(e);
    }
  }

  return (
    <>
      <div className="hero">
        <Contours opacity={0.16} />
        <div style={{ position: 'relative', maxWidth: '62%' }}>
          <div className="eyebrow">{context?.companyName}</div>
          <h1>{context?.dealName || 'Your fundraise'}</h1>
          <p>
            A guided programme from readiness to investor-ready materials — you're{' '}
            <strong style={{ color: '#fff' }}>{overallPct}%</strong> of the way through the delivered stages.
          </p>
          {next && (
            <button className="btn hero-cta" onClick={() => enterStage(next)}>
              {next.completionPct > 0 ? 'Continue' : 'Start'} Stage {next.stageNo}: {stageLabel(next.stageNo)} →
            </button>
          )}
        </div>
        <span className="hero-illo"><Illo name={STAGE_META[next?.stageNo]?.illo || 'summit'} size={150} /></span>
      </div>

      <div className="grid3" style={{ marginTop: 16 }}>
        {built.map((s) => (
          <div key={s.stageNo} className="card card-plain" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="spread">
              <span className="doc-tile-illo"><Illo name={STAGE_META[s.stageNo]?.illo} size={40} /></span>
              <Pill value={s.status} />
            </div>
            <div className="eyebrow" style={{ marginTop: 12 }}>Stage {s.stageNo}</div>
            <h3>{stageLabel(s.stageNo)}</h3>
            <p className="hint" style={{ flex: 1 }}>{STAGE_META[s.stageNo]?.blurb}</p>
            <div className="row" style={{ marginBottom: 10 }}>
              <div style={{ flex: 1, height: 7, background: 'var(--green-050)', borderRadius: 99 }}>
                <div style={{ width: `${s.completionPct || 0}%`, height: '100%', background: 'var(--green-600)', borderRadius: 99, transition: 'width .4s' }} />
              </div>
              <span className="hint" style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(s.completionPct || 0)}%</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => enterStage(s)}>
              {s.status === 'locked' ? '🔒 Locked — open' : 'Open stage'}
            </button>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Needs attention</h3>
          <p className="hint">Upstream information changed — these outputs should be reviewed or regenerated.</p>
          {pending.map((p, i) => (
            <div key={i} className="spread" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <span>{titleCase(p.artifactType)}</span>
              <Pill value={p.status} />
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Company Knowledge Base</h3>
        <p className="hint">
          The single source of truth about your company — powering every stage. Keep it current;
          edits propagate everywhere.
        </p>
        <Link className="btn btn-secondary btn-sm" to={`/deals/${dealId}/ckb`}>Open knowledge base</Link>
      </div>
    </>
  );
}

function stageGateMet(stages, n) {
  return !!stages.find((s) => s.stageNo === n)?.hardGateMet;
}
