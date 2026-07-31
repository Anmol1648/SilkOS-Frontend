// Money everywhere is {value, ccy, usdValue?, basis?} (Gap G13).
// INR is compacted the Indian way (L / Cr); USD/others the western way.

export function fmtNumber(n, ccy) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  n = Number(n);
  const abs = Math.abs(n);
  if (ccy === 'INR') {
    if (abs >= 1e7) return `${trim(n / 1e7)} Cr`;
    if (abs >= 1e5) return `${trim(n / 1e5)} L`;
  } else {
    if (abs >= 1e9) return `${trim(n / 1e9)}B`;
    if (abs >= 1e6) return `${trim(n / 1e6)}M`;
    if (abs >= 1e3) return `${trim(n / 1e3)}K`;
  }
  return trim(n);
}
function trim(x) {
  const s = x.toFixed(Math.abs(x) < 10 ? 2 : Math.abs(x) < 100 ? 1 : 0);
  return s.replace(/\.0+$|(\.\d*[1-9])0+$/, '$1');
}

const SYMBOL = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

export function fmtMoney(m) {
  if (m == null) return '—';
  if (typeof m === 'number') return fmtNumber(m);
  const ccy = m.ccy || 'USD';
  const sym = SYMBOL[ccy] ?? `${ccy} `;
  return `${sym}${fmtNumber(m.value, ccy)}`;
}

export function moneyValue(m) {
  if (m == null) return 0;
  if (typeof m === 'number') return m;
  return Number(m.value ?? 0);
}

export function usdValue(m) {
  if (m == null) return 0;
  if (typeof m === 'number') return m;
  return Number(m.usdValue ?? m.value ?? 0);
}

export function fmtPct(p, digits = 0) {
  if (p === null || p === undefined) return '—';
  return `${Number(p).toFixed(digits)}%`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

export function titleCase(s) {
  return String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
