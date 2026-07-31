import { Link } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';

/**
 * Advisory prerequisites (PRD §2.2/§2.3, C6).
 *
 * This replaces StageGuard, which used to block the page. Stages are never
 * locked: the page always renders, and this panel simply reports what is
 * met and what is still pending, with a link to wherever each pending item
 * is resolved.
 *
 * Only the specific ACTIONS that depend on missing data are disabled — see
 * `ActionGate` below — never the page itself.
 */
export default function PrereqPanel({ stageNo, prerequisites, dealId, companyId }) {
  const { stage } = useConfig();
  const def = stage(stageNo);
  const items = prerequisites || def?.prerequisites || [];

  if (!def && items.length === 0) return null;

  const pending = items.filter((p) => !p.met);

  return (
    <div className="prereq-panel">
      {def?.purpose && <p className="stage-purpose">{def.purpose}</p>}

      {items.length > 0 && (
        <ul className="prereq-list">
          {items.map((p) => (
            <li key={p.key} className={p.met ? 'met' : 'pending'}>
              <span aria-hidden="true">{p.met ? '✓' : '○'}</span>
              <span>
                <strong>{p.label}</strong>
                {!p.met && p.explanation && (
                  <span className="hint"> — {p.explanation}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <p className="hint prereq-footer">
          You can carry on regardless — these are recommendations, not
          requirements.
          {companyId && (
            <>
              {' '}
              <Link to={`/companies/${companyId}/profile`}>Go to Company Profile</Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Wraps a control that depends on data which may not be present yet.
 *
 * C6: the page stays open; only this control is disabled, and it says why.
 */
export function ActionGate({ met, reason, children }) {
  if (met) return children;
  return (
    <span className="action-gate" title={reason}>
      <span className="action-gate-inner" aria-disabled="true">{children}</span>
      {reason && <span className="hint action-gate-reason">{reason}</span>}
    </span>
  );
}
