import { useEffect, useMemo, useState } from 'react';
import { profile as profileApi } from '../../api/endpoints';
import { useToast } from '../../context/AppContext';

/**
 * Headline terms for the raise (C6).
 *
 * Four figures, of which the founder enters two:
 *
 *   1. Target raise           input
 *   2. Pre-money valuation    input
 *   3. Post-money valuation   calculated = pre-money + raise
 *   4. Dilution %             calculated = raise / post-money
 *
 * Post-money and dilution are arithmetic, so they are shown as read-only
 * results rather than editable fields — there is no version of these a
 * founder should be able to type. They update live as the inputs change,
 * and the server recomputes them on save regardless of what the client
 * sends, so the two can never disagree.
 *
 * This is also the escape hatch from the guided strategy: a founder or
 * advisor who already knows their numbers can enter them here and move
 * straight on to Investor Discovery.
 */

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED', 'AUD', 'CAD'];

export default function DealTargetsForm({ companyId, dealId, onSaved, compact }) {
  const { toast, error: toastError } = useToast();
  const [raise, setRaise] = useState('');
  const [preMoney, setPreMoney] = useState('');
  const [ccy, setCcy] = useState('USD');
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState({});

  useEffect(() => {
    const query = dealId ? `?dealId=${dealId}` : '';
    profileApi.dealTargets(companyId, query)
      .then((res) => {
        const t = res?.targets;
        if (!t) return;
        setSaved(t);
        if (t.targetRaise != null) setRaise(String(t.targetRaise));
        if (t.preMoneyValuation != null) setPreMoney(String(t.preMoneyValuation));
        if (t.ccy) setCcy(t.ccy);
      })
      .catch(() => {});
  }, [companyId, dealId]);

  // Mirror the server's arithmetic so the founder sees the consequence of
  // a number as they type it. The server remains authoritative on save.
  const derived = useMemo(() => {
    const r = raise === '' ? null : Number(raise);
    const p = preMoney === '' ? null : Number(preMoney);
    if (r === null || p === null || Number.isNaN(r) || Number.isNaN(p)) {
      return { post: null, dilution: null };
    }
    const post = p + r;
    return {
      post,
      dilution: post > 0 ? (r / post) * 100 : null,
    };
  }, [raise, preMoney]);

  function validate() {
    const next = {};
    if (raise === '') next.targetRaise = 'Enter the amount you plan to raise.';
    else if (Number(raise) < 0) next.targetRaise = 'Enter a positive amount.';
    if (preMoney === '') next.preMoneyValuation = 'Enter the pre-money valuation.';
    else if (Number(preMoney) < 0) next.preMoneyValuation = 'Enter a positive amount.';
    setErrs(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);
    try {
      // Only the two inputs are sent. Post-money and dilution are the
      // server's to compute.
      const res = await profileApi.saveDealTargets(companyId, {
        dealId,
        targetRaise: Number(raise),
        preMoneyValuation: Number(preMoney),
        ccy,
      });
      setSaved(res.targets);
      toast('Deal terms saved.');
      onSaved?.(res.targets);
    } catch (e) {
      setErrs(e.fields || {});
      toastError(e);
    } finally { setBusy(false); }
  }

  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  }));

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Deal terms</h2>
      {!compact && (
        <p className="hint" style={{ marginBottom: 16 }}>
          If you already know what you're raising, enter it here and carry on to
          Investor Discovery — you don't have to work through the guided
          strategy first.
        </p>
      )}

      <div className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: 1, minWidth: 170 }}>
          <span>1 · Target raise</span>
          <input
            type="number"
            min="0"
            step="any"
            value={raise}
            placeholder="2000000"
            onChange={(e) => setRaise(e.target.value)}
          />
          {errs.targetRaise && <span className="field-error">{errs.targetRaise}</span>}
        </label>

        <label className="field" style={{ flex: 1, minWidth: 170 }}>
          <span>2 · Pre-money valuation</span>
          <input
            type="number"
            min="0"
            step="any"
            value={preMoney}
            placeholder="8000000"
            onChange={(e) => setPreMoney(e.target.value)}
          />
          {errs.preMoneyValuation && (
            <span className="field-error">{errs.preMoneyValuation}</span>
          )}
        </label>

        <label className="field" style={{ width: 110 }}>
          <span>Currency</span>
          <select value={ccy} onChange={(e) => setCcy(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {/* 3 and 4 — calculated, never entered. */}
      <div className="derived-grid">
        <div className="derived-metric">
          <div className="eyebrow">3 · Post-money valuation</div>
          <div className="calc-value">
            {derived.post != null ? `${ccy} ${fmt(derived.post)}` : '—'}
          </div>
          <div className="hint">pre-money + raise</div>
        </div>
        <div className="derived-metric">
          <div className="eyebrow">4 · Dilution</div>
          <div className="calc-value">
            {derived.dilution != null ? `${derived.dilution.toFixed(2)}%` : '—'}
          </div>
          <div className="hint">raise ÷ post-money</div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
          {busy && <span className="spin" style={{ borderTopColor: '#fff' }} />}
          Save deal terms
        </button>
        {saved?.isComplete && (
          <span className="hint">
            Saved{saved.updatedAt ? '' : ''} — Investor Discovery is now available.
          </span>
        )}
      </div>

      {saved?.usd?.targetRaise != null && ccy !== 'USD' && (
        <p className="hint" style={{ marginTop: 10 }}>
          In US$: raise {fmt(saved.usd.targetRaise)} on a post-money of{' '}
          {fmt(saved.usd.postMoneyValuation)}
          {saved.fx?.rateUsed
            ? ` · converted at ${ccy} ${Number(saved.fx.rateUsed).toFixed(2)} per US$`
            : ''}
          {saved.fx?.asOf ? ` (as at ${saved.fx.asOf})` : ''}.
        </p>
      )}

      {derived.dilution != null && derived.dilution > 30 && (
        <p className="field-error" style={{ marginTop: 10 }}>
          That's {derived.dilution.toFixed(1)}% dilution in a single round —
          higher than most founders would want to give away this early. Worth
          checking the pre-money before you take it to investors.
        </p>
      )}
    </div>
  );
}
