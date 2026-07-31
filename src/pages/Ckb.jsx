import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeal } from '../context/DealContext';
import { useConfig } from '../context/ConfigContext';
import { useToast } from '../context/AppContext';
import { ckb as ckbApi, deal as dealApi } from '../api/endpoints';
import { Pill, SkeletonCard } from '../components/ui';
import { fmtNumber, titleCase } from '../lib/format';

const GROUP_ORDER = ['company', 'business', 'financial', 'customers', 'team', 'shareholding', 'legal', ''];
const MONEY_KEYS = new Set(['arr', 'mrr', 'revenue', 'ebitda', 'burn', 'cac', 'ltv', 'cash', 'cash_balance']);
const NUM_KEYS = new Set(['founding_year', 'employees', 'customers', 'paying_customers', 'enterprise_customers', 'growth_rate', 'runway_months', 'gross_margin', 'churn', 'customer_concentration']);

export function useCkb(dealId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try { setData(await ckbApi.read(dealId)); } finally { setLoading(false); }
  }, [dealId]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, reload };
}

export default function CkbPage() {
  const { dealId } = useDeal();
  const { brand } = useConfig();
  return (
    <>
      <div className="eyebrow">Company Knowledge Base</div>
      <h1>Everything {brand.productName} knows about your company</h1>
      <p className="section-note">
        Each fact carries its source and confidence. Confirming a value marks it verified — AI never
        overwrites a verified value; it parks a suggestion beside it for you to accept or reject.
        Editing a material fact flags dependent outputs for recalculation.
      </p>
      <CkbEditor dealId={dealId} />
    </>
  );
}

/** Reusable grouped editor — used by the CKB screen and Stage-1 Pillar 2. */
export function CkbEditor({ dealId, groupsFilter }) {
  const { data, loading, reload } = useCkb(dealId);
  const { toast, error: toastError } = useToast();
  const [warnings, setWarnings] = useState({}); // fieldKey → [warning]
  const [fieldErrors, setFieldErrors] = useState({}); // fieldKey → message (BUG-005)
  // Tester Issue 1: section assignment — load deal members once for the
  // per-section "Assign to…" control.
  const [members, setMembers] = useState([]);
  useEffect(() => {
    dealApi.members(dealId)
      .then((r) => setMembers(r.items || r.members || []))
      .catch(() => setMembers([]));
  }, [dealId]);
  const timers = useRef({});

  if (loading) return <SkeletonCard lines={5} />;
  if (!data) return <p className="hint">Knowledge base unavailable.</p>;

  const groups = Object.entries(data.groups || {})
    .filter(([g]) => !groupsFilter || groupsFilter.includes(g))
    .sort(([a], [b]) => idx(a) - idx(b));

  async function save(field, value, ccy) {
    try {
      const body = { value: coerce(field, value) };
      if (ccy) body.ccy = ccy;
      const res = await ckbApi.setField(dealId, field.fieldKey, body);
      setWarnings((w) => ({ ...w, [field.fieldKey]: res?.warnings || [] }));
      setFieldErrors((e) => ({ ...e, [field.fieldKey]: null }));
      if (res?.warnings?.length) toast(res.warnings[0].message || 'Saved with an advisory note');
      reload();
      return true;
    } catch (e) {
      // BUG-005: a server-side 422 must be visible AT THE FIELD, and the
      // rejected value must not sit in the input looking saved.
      const msg = e?.fields?.[field.fieldKey] || e?.detail || e?.message || 'Value rejected.';
      setFieldErrors((errs) => ({ ...errs, [field.fieldKey]: String(msg) }));
      if (e?.status !== 422) toastError(e);
      return false;
    }
  }

  function autosave(field, value, ccy) {
    clearTimeout(timers.current[field.fieldKey]);
    timers.current[field.fieldKey] = setTimeout(() => save(field, value, ccy), 800); // debounced ~800ms (M0-§7)
  }

  async function assignSection(groupKey, assigneeUserId) {
    try {
      await ckbApi.assign(dealId, { groupKey, assigneeUserId: assigneeUserId || null });
      toast(assigneeUserId
        ? `${titleCase(groupKey)} section assigned — the assignee has been notified.`
        : `${titleCase(groupKey)} section unassigned.`);
      reload();
    } catch (e) { toastError(e); }
  }

  async function suggestion(field, action) {
    try {
      await ckbApi.suggestionAction(dealId, field.fieldKey, action);
      toast(action === 'accept'
        ? 'Value verified — research provenance and confidence retained.'
        : 'Value rejected — it will resurface in the gap analysis.');
      reload();
    } catch (e) { toastError(e); }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="spread">
          <strong>Completeness</strong>
          <span className="money-range" style={{ fontSize: 20 }}>{Math.round(data.completenessPct || 0)}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--green-050)', borderRadius: 99, marginTop: 8 }}>
          <div style={{ width: `${data.completenessPct || 0}%`, height: '100%', background: 'var(--green-600)', borderRadius: 99 }} />
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Completeness feeds your Stage-1 readiness score.</p>
      </div>

      {groups.map(([groupKey, fields]) => (
        <div key={groupKey || 'general'} className="card">
          <div className="spread" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>{groupKey ? titleCase(groupKey) : 'General & financial metrics'}</h3>
            {groupKey && (
              <SectionAssignee
                groupKey={groupKey}
                assignment={data.assignments?.[groupKey]}
                members={members}
                onAssign={(uid) => assignSection(groupKey, uid)}
              />
            )}
          </div>
          <table className="data">
            <thead>
              <tr><th style={{ width: '24%' }}>Field</th><th>Value</th><th style={{ width: 130 }}>Source</th><th style={{ width: 110 }}>Status</th></tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <FieldRow key={f.fieldKey} field={f} warnings={warnings[f.fieldKey]}
                  fieldError={fieldErrors[f.fieldKey]}
                  onSave={(v, ccy) => autosave(f, v, ccy)} onSuggestion={(a) => suggestion(f, a)} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

/** Tester Issue 1: per-section ownership — shows the current assignee and
 *  offers assignment to any deal member. Persists server-side and notifies
 *  the assignee. */
function SectionAssignee({ groupKey, assignment, members, onAssign }) {
  return (
    <span className="row" style={{ gap: 8 }}>
      {assignment && (
        <Pill value="active" title={assignment.assigneeEmail}>
          Assigned: {assignment.assigneeName || assignment.assigneeEmail}
        </Pill>
      )}
      <select
        className="input"
        aria-label={`Assign ${groupKey} section`}
        value={assignment?.assigneeUserId || ''}
        onChange={(e) => onAssign(e.target.value)}
        style={{ maxWidth: 190, padding: '4px 8px', fontSize: 12.5 }}
      >
        <option value="">{assignment ? 'Unassign' : 'Assign to…'}</option>
        {members.map((m) => (
          <option key={m.userId || m.id} value={m.userId || m.id}>
            {m.displayName || m.name || m.email} {m.role ? `(${m.role})` : ''}
          </option>
        ))}
      </select>
    </span>
  );
}

function FieldRow({ field, warnings, fieldError, onSave, onSuggestion }) {
  const [val, setVal] = useState(field.value ?? '');
  const isMoney = MONEY_KEYS.has(field.fieldKey);
  useEffect(() => { setVal(field.value ?? ''); }, [field.value]);
  // BUG-005: on a rejected save, put the last-good server value back so the
  // invalid input never sits there looking saved.
  useEffect(() => { if (fieldError) setVal(field.value ?? ''); }, [fieldError]); // eslint-disable-line react-hooks/exhaustive-deps

  // BUG-004: an AI-discovered value that isn't verified yet needs explicit
  // Accept (verify, keep provenance) / Reject (clear) controls — editing it
  // reassigns the source to "Founder" and destroys the research provenance.
  const aiUnverified = !field.verified && field.value != null
    && ['ai_research', 'document_extracted'].includes(field.source);

  return (
    <tr>
      <td>
        <strong>{titleCase(field.fieldKey)}</strong>
        {field.factOrInference && <div><Pill value={field.factOrInference} /></div>}
      </td>
      <td>
        <div className="row">
          <input
            type={typeof field.value === 'number' || isMoney || NUM_KEYS.has(field.fieldKey) ? 'number' : 'text'}
            value={val}
            placeholder="Missing — add a value"
            onChange={(e) => { setVal(e.target.value); onSave(e.target.value, field.ccy); }}
            style={{ maxWidth: 260, borderColor: fieldError ? 'var(--red-600, #dc2626)' : undefined }}
            aria-invalid={!!fieldError}
          />
          {isMoney && <span className="hint">{field.ccy || 'INR'}</span>}
        </div>
        {fieldError && (
          <div className="field-error" style={{ marginTop: 3 }}>
            ✕ {fieldError} — the previous value has been restored.
          </div>
        )}
        {isMoney && field.value != null && (
          <div className="hint" style={{ marginTop: 3 }}>
            {fmtNumber(field.value, field.ccy || 'INR')} {field.ccy || 'INR'}
            {field.usdValue != null && <> · ≈ ${fmtNumber(field.usdValue, 'USD')} USD</>}
          </div>
        )}
        {(warnings || []).map((w, i) => (
          <div key={i} className="hint" style={{ color: 'var(--amber-600)', marginTop: 3 }}>⚠ {w.message} (advisory)</div>
        ))}
        {aiUnverified && (
          <div className="banner banner-amber" style={{ marginTop: 8, marginBottom: 0 }}>
            AI-discovered ({Math.round((field.confidence || 0) * 100)}% confidence) — verify?
            <span className="row" style={{ marginLeft: 'auto' }}>
              <button className="btn btn-sm btn-primary" onClick={() => onSuggestion('accept')}>Accept</button>
              <button className="btn btn-sm btn-secondary" onClick={() => onSuggestion('reject')}>Reject</button>
            </span>
          </div>
        )}
        {field.suggestedValue != null && (
          <div className="banner banner-amber" style={{ marginTop: 8, marginBottom: 0 }}>
            AI suggests: <strong>{String(field.suggestedValue?.value ?? field.suggestedValue)}</strong>
            <span className="row" style={{ marginLeft: 'auto' }}>
              <button className="btn btn-sm btn-primary" onClick={() => onSuggestion('accept')}>Accept</button>
              <button className="btn btn-sm btn-secondary" onClick={() => onSuggestion('reject')}>Reject</button>
            </span>
          </div>
        )}
      </td>
      <td>
        <span className="hint">{titleCase(field.source || '—')}</span>
        {field.confidence != null && <div className="hint">conf {Math.round(field.confidence * 100)}%</div>}
      </td>
      <td>
        {field.verified
          ? <Pill value="ready">✓ Verified</Pill>
          : field.value != null ? <Pill value="pending">Unverified</Pill> : <Pill value="missing">Missing</Pill>}
      </td>
    </tr>
  );
}

function idx(g) { const i = GROUP_ORDER.indexOf(g); return i === -1 ? 99 : i; }
function coerce(field, value) {
  if (value === '' || value == null) return null;
  if (typeof field.value === 'number' || MONEY_KEYS.has(field.fieldKey) || NUM_KEYS.has(field.fieldKey)) {
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }
  return value;
}
