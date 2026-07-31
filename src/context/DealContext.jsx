import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { deal as dealApi, me } from '../api/endpoints';

const DealCtx = createContext(null);

// A deal id is a UUID. Guard against a malformed/absent id reaching the API:
// navigating with an undefined id produced the literal path /deals/undefined
// and fired a storm of 404s (plus a 500 on /contexts/switch).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidDealId = (id) => typeof id === 'string' && UUID_RE.test(id);

export function DealProvider({ children, dealId: explicitDealId }) {
  // Company-scoped routes (/companies/:id/strategy) carry no :dealId in the
  // URL, so the provider accepts one explicitly. URL param wins when present.
  const { dealId: routeDealId } = useParams();
  const dealId = explicitDealId || routeDealId;
  const [masterplan, setMasterplan] = useState(null);
  const [context, setContext] = useState(null); // {dealName, companyName, role}
  const [loading, setLoading] = useState(true);

  const valid = isValidDealId(dealId);

  const refreshPlan = useCallback(async () => {
    if (!valid) return;
    try { setMasterplan(await dealApi.masterplan(dealId)); }
    catch { /* rail degrades gracefully */ }
  }, [dealId, valid]);

  useEffect(() => {
    if (!valid) { setLoading(false); return undefined; }
    let alive = true;
    setLoading(true);
    (async () => {
      // Record the active working deal (UX only — never authorisation).
      me.switchContext(dealId).catch(() => {});
      const [plan, ctxs] = await Promise.allSettled([dealApi.masterplan(dealId), me.contexts()]);
      if (!alive) return;
      if (plan.status === 'fulfilled') setMasterplan(plan.value);
      if (ctxs.status === 'fulfilled') {
        setContext(ctxs.value.items?.find((i) => i.dealId === dealId) || null);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [dealId, valid]);

  const stage = useCallback(
    (n) => masterplan?.stages?.find((s) => s.stageNo === n) || null,
    [masterplan],
  );

  const value = useMemo(() => ({
    dealId, masterplan, context, loading, stage, refreshPlan,
  }), [dealId, masterplan, context, loading, stage, refreshPlan]);

  // Bad id in the URL → back to the picker rather than rendering a broken
  // deal shell and hammering the API with /deals/undefined/... calls.
  // An explicitly-supplied id is the caller's responsibility: it renders
  // children with an empty context rather than yanking the user elsewhere.
  if (!valid && !explicitDealId) return <Navigate to="/start" replace />;

  return <DealCtx.Provider value={value}>{children}</DealCtx.Provider>;
}

/** Safe empty context.
 *
 *  QA 24-Jul issues 6 & 7: `createContext(null)` meant any component
 *  rendered outside a DealProvider threw
 *  "Cannot destructure property 'dealId' of ... as it is null" and took the
 *  whole page down. A missing provider is a routing mistake, not a reason
 *  to crash — callers already handle an absent dealId, so return a shape
 *  they can read.
 */
const EMPTY_DEAL = {
  dealId: null,
  masterplan: null,
  context: null,
  loading: false,
  stage: () => null,
  refreshPlan: async () => {},
};

export const useDeal = () => useContext(DealCtx) || EMPTY_DEAL;
