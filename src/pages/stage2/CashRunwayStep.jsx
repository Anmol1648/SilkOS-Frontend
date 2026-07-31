import { useEffect, useState } from 'react';
import { profile as profileApi } from '../../api/endpoints';
import { useToast } from '../../context/AppContext';
import { fmtDate } from '../../lib/format';

/**
 * Cash position & runway (PRD §6 Step 2).
 *
 * C5 — burn is an INPUT, not a derived field: the average monthly NET cash
 * burn. A company may be profitable, in which case burn is zero or negative
 * and runway is not the binding constraint. That case is stated plainly
 * rather than shown as an implausibly large number.
 *
 * All three outputs are computed server-side by the deterministic engine,
 * never by the language model.
 */
export default function CashRunwayStep({ companyId, desiredRunwayMonths, onSaved }) {
  const { toast, error: toastError } = useToast();
  const [row, setRow] = useState(null);
  const [cash, setCash] = useState('');
  const [burn, setBurn] = useState('');
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [ccy, setCcy] = useState('USD');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    profileApi.cashPosition(companyId)
      .then((res) => {
        if (!res) return;
        setRow(res);
        if (res.cashInBank != null) setCash(String(res.cashInBank));
        if (res.monthlyBurn != null) setBurn(String(res.monthlyBurn));
        if (res.ccy) setCcy(res.ccy);
        if (res.asOfDate) setAsOf(res.asOfDate);
      })
      .catch(() => {});
  }, [companyId]);

  async function save() {
    setBusy(true);
    try {
      const res = await profileApi.saveCashPosition(companyId, {
        cashInBank: cash === '' ? null : Number(cash),
        monthlyBurn: burn === '' ? null : Number(burn),
        ccy,
        asOfDate: asOf,
        desiredRunwayMonths,
      });
      setRow(res);
      toast('Cash position saved.');
      onSaved?.(res);
    } catch (e) { toastError(e); }
    finally { setBusy(false); }
  }

  const burnNum = burn === '' ? null : Number(burn);
  const profitable = burnNum !== null && burnNum <= 0;

  return (
    <div className="card">
      <h2>Cash position &amp; runway</h2>
      <p className="hint" style={{ marginBottom: 16 }}>
        How much cash you have and how fast you're using it. This drives the
        recommended raise, so it's worth getting right.
      </p>

      <div className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: 1, minWidth: 180 }}>
          <span>Cash in bank</span>
          <input
            type="number"
            value={cash}
            min="0"
            step="any"
            placeholder="0"
            onChange={(e) => setCash(e.target.value)}
          />
        </label>

        <label className="field" style={{ flex: 1, minWidth: 180 }}>
          <span>Average monthly net burn</span>
          <input
            type="number"
            value={burn}
            step="any"
            placeholder="0"
            onChange={(e) => setBurn(e.target.value)}
          />
          {/* C5 — the definition sits beside the input so the figure is
              entered consistently. */}
          <span className="hint">
            Cash out less cash in, averaged over recent months. Enter 0 (or a
            negative number) if you're profitable.
          </span>
        </label>

        <label className="field" style={{ width: 110 }}>
          <span>Currency</span>
          <select value={ccy} onChange={(e) => setCcy(e.target.value)}>
            {['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED', 'AUD', 'CAD'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="field" style={{ width: 170 }}>
          <span>Cash accurate as at</span>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </label>
      </div>

      <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
        {busy && <span className="spin" style={{ borderTopColor: '#fff' }} />}
        Calculate
      </button>

      {row && (
        <div className="calc-grid">
          {row.isProfitable || profitable ? (
            <div className="calc-note">
              <strong>Runway isn't your constraint.</strong>
              <p className="hint" style={{ margin: '4px 0 0' }}>
                With no net burn, the raise is driven by your growth plans and
                what comparable companies raise — not by when cash runs out.
              </p>
            </div>
          ) : (
            <>
              <Metric
                label="Current runway"
                value={row.runwayMonths != null ? `${row.runwayMonths} months` : '—'}
              />
              <Metric
                label="Cash runs out"
                value={row.cashExhaustionDate ? fmtDate(row.cashExhaustionDate) : '—'}
              />
              <Metric
                label="Additional capital required"
                value={row.additionalCapitalRequiredUsd != null
                  ? `US$${Number(row.additionalCapitalRequiredUsd).toLocaleString()}`
                  : '—'}
                hint={desiredRunwayMonths
                  ? `to reach ${desiredRunwayMonths} months of runway`
                  : ''}
              />
            </>
          )}
        </div>
      )}

      {row?.fxRateUsed && ccy !== 'USD' && (
        <p className="hint" style={{ marginTop: 10 }}>
          Converted at {ccy} {Number(row.fxRateUsed).toFixed(2)} per US$
          {row.fxAsOf ? ` (as at ${fmtDate(row.fxAsOf)})` : ''}.
        </p>
      )}

      {/* Surfaces the tension the advisors would want flagged. */}
      {row && !row.isProfitable && row.runwayMonths != null
        && desiredRunwayMonths && Number(row.runwayMonths) < 6 && (
        <p className="field-error" style={{ marginTop: 10 }}>
          Your runway is under six months. Fundraising typically takes three to
          six months, so this is tight — consider bridge options in parallel.
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="calc-metric">
      <div className="eyebrow">{label}</div>
      <div className="calc-value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
