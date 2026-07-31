import { useEffect, useState } from 'react';
import { profile as profileApi } from '../../api/endpoints';
import { useToast } from '../../context/AppContext';
import { AiBadge, Pill } from '../../components/ui';

/**
 * Fund-raise bucket selection (C9).
 *
 * The seven values are the amounts a founder can target. Which one is
 * *recommended* comes from the Outline's traction rules — ARR, capital
 * already raised, whether the founder is full-time — evaluated server-side
 * against admin-configured thresholds.
 *
 * The recommendation is a default, not a constraint: the founder or advisor
 * may pick any other bucket, and the reasoning for the default stays visible
 * so an override is an informed one.
 */
export default function FundraiseBuckets({ companyId, value, onChange }) {
  const { error: toastError } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profileApi.fundraiseRecommendation(companyId)
      .then((res) => {
        setData(res);
        // Pre-select the recommendation the first time through — but only
        // when it IS one. With insufficient data the backend returns a
        // placeholder bucket, and pre-selecting it would present a guess as
        // an answer.
        if (!value && res?.recommended?.bucketNo
            && !res.recommended.insufficientData) {
          onChange?.(res.recommended.bucketNo);
        }
      })
      .catch(toastError)
      .finally(() => setLoading(false));
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="card"><span className="spin" /> Working out your range…</div>;
  if (!data) return null;

  const rec = data.recommended;
  const selected = value ?? rec?.bucketNo;

  return (
    <div className="card">
      <div className="panel-title">
        <h2 style={{ margin: 0 }}>How much to raise</h2>
        <AiBadge />
      </div>

      {rec?.insufficientData && (
        <div className="recommendation-note">
          <strong>We need a little more information</strong>
          <p className="hint" style={{ margin: '6px 0 0' }}>{rec.rationale}</p>
          <p className="hint" style={{ margin: '6px 0 0' }}>
            You can still choose a target below — nothing is pre-selected
            until we can base it on your numbers.
          </p>
        </div>
      )}

      {rec && !rec.insufficientData && (
        <div className="recommendation-note">
          <div className="spread">
            <strong>Recommended: {rec.label}</strong>
            <span className="hint">{rec.typicalStage}</span>
          </div>
          <p className="hint" style={{ margin: '6px 0 0' }}>{rec.rationale}</p>

          {rec.upliftApplied?.length > 0 && rec.upliftApplied.map((u, i) => (
            <p key={i} className="hint uplift-note">
              ↑ {u.name}: raised by {u.levels} level{u.levels > 1 ? 's' : ''}. {u.rationale}
            </p>
          ))}

          {rec.advice && (
            <div className="advice-box">
              <strong>Suggested next step</strong>
              <p className="hint" style={{ margin: '4px 0 0' }}>{rec.advice}</p>
            </div>
          )}
        </div>
      )}

      <p className="hint" style={{ margin: '14px 0 10px' }}>
        This is a starting point based on your traction. Pick a different target
        if you have reason to.
      </p>

      <div className="bucket-grid">
        {(data.allBuckets || []).map((b) => {
          const isSel = b.bucketNo === selected;
          const isRec = rec && b.bucketNo === rec.bucketNo;
          return (
            <button
              key={b.bucketNo}
              type="button"
              className={`bucket-tile${isSel ? ' selected' : ''}`}
              onClick={() => onChange?.(b.bucketNo)}
            >
              <span className="bucket-amount">{b.label}</span>
              <span className="hint bucket-stage">{b.typicalStage}</span>
              <span className="hint">
                {b.dilutionLowPct}–{b.dilutionHighPct}% dilution
              </span>
              {(b.investorTypes || []).length > 0 && (
                <span className="hint bucket-investors">
                  {b.investorTypes.join(', ')}
                </span>
              )}
              {isRec && <Pill value="approved">Recommended</Pill>}
            </button>
          );
        })}
      </div>

      {selected && rec && selected !== rec.bucketNo && (
        <p className="hint" style={{ marginTop: 12 }}>
          You've chosen a different target from the recommendation. That's fine —
          the strategy will be built around your choice.
        </p>
      )}
    </div>
  );
}
