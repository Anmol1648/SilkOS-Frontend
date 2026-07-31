import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDeal } from '../../context/DealContext';
import { useConfig } from '../../context/ConfigContext';
import { stage3 as api } from '../../api/endpoints';
import { GatePanel, Pill, SkeletonCard } from '../../components/ui';
import { titleCase } from '../../lib/format';
import { Illo } from '../../components/illos';

// The recommended build order — story is the spine, review is the gate.
export const DOC_FLOW = [
  { key: 'story',  title: 'Investment Story',      illo: 'pen',       blurb: 'The narrative spine every document draws from — build and approve it first.' },
  { key: 'teaser', title: 'Executive Teaser',      illo: 'envelope',  blurb: 'The one-to-five-page first impression for investors.' },
  { key: 'deck',   title: 'Pitch Deck',            illo: 'easel',     blurb: 'Outline first, then slides — every slide answers one investor question.' },
  { key: 'model',  title: 'Financial Model',       illo: 'ledger',    blurb: 'A deterministic three-statement model with editable assumptions.' },
  { key: 'im',     title: 'Investment Memorandum', illo: 'memo',      blurb: 'The full institutional document, section by section.' },
  { key: 'review', title: 'AI Review & Package',   illo: 'magnifier', blurb: 'Quality score, cross-document consistency, investor objections — then freeze the package.' },
];

/** Shared hook: loads the workspace.
 *
 *  CR-02 / C6 — the page is never blocked. The read now returns 200 with
 *  `available:false` and the outstanding prerequisites when the strategy
 *  isn't approved yet; only the generate actions stay disabled. The legacy
 *  423 branch is kept so an older backend still degrades sensibly.
 */
export function useWorkspace(dealId) {
  const [ws, setWs] = useState(null);
  const [gated, setGated] = useState(false);
  const [prereqs, setPrereqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    api.workspace(dealId)
      .then((w) => {
        setWs(w);
        setPrereqs(w?.prerequisites || []);
        setGated(w?.available === false);
      })
      .catch((e) => { if (e.isGate) setGated(true); })
      .finally(() => setLoading(false));
  }, [dealId]);
  useEffect(() => { reload(); }, [reload]);
  return { ws, gated, prereqs, loading, reload };
}

/** Explains what is outstanding. Not a lock — the page renders regardless
 *  and the founder can read everything; only generation is unavailable. */
export function Stage3Gate({ dealId }) {
  return (
    <GatePanel
      title="Generating materials needs an approved strategy"
      detail="Investor materials are built from the approved Strategy Profile so every document stays consistent with your plan. You can look around here now — approve your strategy in Stage 2, or enter your headline terms directly, to start generating."
      to={`/deals/${dealId}/stage/2?step=5`}
      linkLabel="Go to Stage 2"
    />
  );
}

export default function Stage3Hub() {
  const { dealId } = useDeal();
  const { stageLabel } = useConfig();
  const navigate = useNavigate();
  const { ws, gated, loading } = useWorkspace(dealId);

  if (loading) return <><SkeletonCard /><SkeletonCard /></>;

  const docs = ws?.documents || [];
  const byType = Object.fromEntries(docs.map((d) => [d.docType, d]));

  return (
    <>
      <div className="eyebrow">Stage 3 · {stageLabel(3)}</div>
      <h1>Your investor package, never from a blank page</h1>
      <p className="section-note">
        Every document starts as an AI first draft built from your knowledge base, approved strategy
        and peer universe — you refine, you don’t create. Work through them in order; the review at
        the end checks the whole package the way a banker would.
      </p>

      {gated && <Stage3Gate dealId={dealId} />}

      <div className="grid2">
        {DOC_FLOW.map((d, i) => {
          const doc = byType[d.key];
          const status = doc?.status || (d.key === 'review' ? 'Final gate' : 'Not started');
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => navigate(`/deals/${dealId}/stage/3/${d.key}`)}
              className="card card-plain"
              style={{ textAlign: 'left', cursor: 'pointer' }}
            >
              <div className="spread">
                <span className="doc-tile-illo"><Illo name={d.illo} size={40} /></span>
                <Pill value={String(status).toLowerCase().replace(/\s+/g, '_')}>{titleCase(status)}</Pill>
              </div>
              <div className="eyebrow" style={{ marginTop: 12 }}>Step {i + 1}</div>
              <h3>{d.title}</h3>
              <p className="hint">{d.blurb}</p>
              {doc?.currentVersionId && <span className="pill pill-grey">has a current version</span>}
            </button>
          );
        })}
      </div>

      <p className="hint" style={{ marginTop: 18 }}>
        Workspace linked to Strategy Profile <code>{ws?.strategyProfileId?.slice(0, 8)}…</code> — every
        generation reads the latest approved strategy, keeping documents mutually consistent.{' '}
        <Link to={`/deals/${dealId}/stage/2?step=5`}>View strategy</Link>
      </p>
    </>
  );
}
