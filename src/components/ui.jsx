// Cross-cutting components (Screen Spec §7 — build once, use everywhere).
import { Link } from 'react-router-dom';
import { fmtMoney } from '../lib/format';
import { Illo } from './illos';

/** 'AI Generated Insights' badge (+ optional needs-review marker). LLM-M0 posture. */
export function AiBadge({ needsReview }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className="ai-badge">✦ AI Generated Insights</span>
      {needsReview && <span className="ai-badge needs-review">Needs review</span>}
    </span>
  );
}

/** Money range: low–high + currency + inseparable disclaimer (guardrail). */
export function MoneyRange({ low, high, disclaimer, label }) {
  return (
    <div>
      {label && <div className="eyebrow">{label}</div>}
      <div className="money-range">
        {fmtMoney(low)} <span style={{ color: 'var(--faint)', fontWeight: 500 }}>–</span> {fmtMoney(high)}
        <span className="ccy">{(high?.ccy || low?.ccy || '')}</span>
      </div>
      {disclaimer && <div className="disclaimer">{disclaimer}</div>}
    </div>
  );
}

/** Locked-state panel for a 423 hard gate, linking to the blocking step. */
export function GatePanel({ title, detail, to, linkLabel, illo = 'gate' }) {
  return (
    <div className="gate-panel">
      <span className="illo-wrap"><Illo name={illo} size={104} /></span>
      <h3>{title}</h3>
      <p className="hint" style={{ maxWidth: 460, margin: '0 auto 14px' }}>{detail}</p>
      {to && <Link className="btn btn-primary" to={to}>{linkLabel || 'Go to the blocking step'}</Link>}
    </div>
  );
}

export function Banner({ kind = 'amber', children, action }) {
  return (
    <div className={`banner banner-${kind}`}>
      <span style={{ flex: 1 }}>{children}</span>
      {action}
    </div>
  );
}

export function Skeleton({ h = 18, w = '100%', style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} aria-hidden />;
}
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card">
      <Skeleton h={22} w="40%" style={{ marginBottom: 14 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} h={14} w={`${90 - i * 12}%`} style={{ marginBottom: 10 }} />
      ))}
    </div>
  );
}

const PILL_TONE = {
  ready: 'green', complete: 'green', clean: 'green', approved: 'green', current: 'green',
  active: 'green', succeeded: 'green', fact: 'green',
  in_progress: 'blue', running: 'blue', queued: 'blue', draft: 'blue', pending: 'blue', inference: 'blue',
  needs_attention: 'amber', pending_recalc: 'amber', needs_review: 'amber', medium: 'amber',
  missing: 'red', failed: 'red', infected: 'red', high: 'red', locked: 'grey', available: 'grey', low: 'grey',
};
export function Pill({ value, children }) {
  const key = String(value ?? children ?? '').toLowerCase().replace(/\s+/g, '_');
  const tone = PILL_TONE[key] || 'grey';
  return <span className={`pill pill-${tone}`}>{children ?? String(value).replace(/_/g, ' ')}</span>;
}

/** Stage completion ring for the masterplan rail. */
export function Ring({ pct = 0, size = 26 }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#8FD3B4" strokeWidth="3"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(pct, 100) / 100)} strokeLinecap="round" />
      </svg>
      <span className="pct">{Math.round(pct)}</span>
    </span>
  );
}

/** Guided step header — the flow spine used by every stage wizard. */
export function StepFlow({ steps, current, onStep, doneUpTo = -1 }) {
  return (
    <div className="stepflow" role="tablist" aria-label="Steps">
      {steps.map((s, i) => (
        <span key={s} className="row" style={{ gap: 0 }}>
          {i > 0 && <span className={`spine ${i <= doneUpTo + 1 && i <= current ? 'done' : ''}`} />}
          <button
            type="button" role="tab" aria-selected={i === current}
            className={`step ${i === current ? 'current' : ''} ${i <= doneUpTo ? 'done' : ''}`}
            onClick={() => onStep(i)}
          >
            <span className="dot">{i <= doneUpTo ? '✓' : i + 1}</span>
            {s}
          </button>
        </span>
      ))}
    </div>
  );
}

export function StepNav({ onBack, onNext, nextLabel = 'Continue', nextDisabled, backLabel = 'Back', extra }) {
  return (
    <div className="step-nav">
      <span>{onBack && <button className="btn btn-secondary" onClick={onBack}>{backLabel}</button>}</span>
      <span className="row">
        {extra}
        {onNext && <button className="btn btn-primary" onClick={onNext} disabled={nextDisabled}>{nextLabel} →</button>}
      </span>
    </div>
  );
}

/** Empty-state + Generate CTA + progress messaging (non-blocking AI, M0-§7). */
export function GeneratePanel({ title, explainer, cta = 'Generate', onGenerate, generating, progressLines = [], illo = 'spark' }) {
  return (
    <div className="gate-panel" style={{ borderStyle: 'solid' }}>
      {generating ? (
        <>
          <span className="illo-wrap" style={{ opacity: .85 }}><Illo name={illo} size={92} /></span>
          <div className="row" style={{ justifyContent: 'center', marginBottom: 10 }}>
            <span className="spin" /><strong>Working…</strong>
          </div>
          <ProgressCycler lines={progressLines.length ? progressLines : ['Assembling context…', 'Generating…']} />
        </>
      ) : (
        <>
          <span className="illo-wrap"><Illo name={illo} size={104} /></span>
          <h3>{title}</h3>
          <p className="hint" style={{ maxWidth: 480, margin: '0 auto 16px' }}>{explainer}</p>
          <button className="btn btn-primary" onClick={onGenerate}>{cta}</button>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
function ProgressCycler({ lines }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % lines.length), 2600);
    return () => clearInterval(t);
  }, [lines.length]);
  return <p className="hint">{lines[i]}</p>;
}

/** Version chip. */
export function VersionChip({ v }) {
  if (v == null) return null;
  return <span className="pill pill-grey">v{v}</span>;
}

export function Tooltip({ content, children, width = 260 }) {
  const [show, setShow] = useState(false);
  return (
    <div 
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: 'relative', display: 'inline-flex', width: '100%' }}
    >
      {children}
      {show && content && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
          background: 'var(--ink, #1f2937)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '13px',
          whiteSpace: 'normal',
          width: width,
          textAlign: 'center',
          zIndex: 100,
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          lineHeight: 1.4
        }}>
          {content}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            borderWidth: '5px',
            borderStyle: 'solid',
            borderColor: 'var(--ink, #1f2937) transparent transparent transparent'
          }} />
        </div>
      )}
    </div>
  );
}
