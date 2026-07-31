/**
 * FundOS illustration library — hand-drawn-feel line art, all inline SVG.
 * Stroke follows currentColor; the warm gold accent is fixed so illustrations
 * read the same on paper and on deep-green panels. No external images.
 */

const GOLD = '#C8A24B';
const MINT = '#8FD3B4';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
const Sthin = { ...S, strokeWidth: 1.6 };

function Frame({ children, size = 96, label }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={label} style={{ display: 'block' }}>
      {children}
    </svg>
  );
}

/* Research — telescope scanning the market sky */
const Telescope = () => (
  <>
    <circle cx="92" cy="26" r="3" fill={GOLD} stroke="none" />
    <circle cx="72" cy="16" r="1.8" fill={MINT} stroke="none" />
    <circle cx="104" cy="46" r="1.8" fill={MINT} stroke="none" />
    <path {...S} d="M22 74 66 38l10 13-44 36z" />
    <path {...S} d="M66 38l8-7 12 15-8 7" />
    <path {...Sthin} d="M86 31l6-5" />
    <path {...S} d="M46 84v22M46 106l-14 8M46 106l14 8" />
    <circle cx="30" cy="66" r="4" {...Sthin} />
  </>
);

/* Founder info — fieldbook with a verified leaf */
const Fieldbook = () => (
  <>
    <path {...S} d="M30 22h48a8 8 0 0 1 8 8v62a8 8 0 0 0-8-8H30z" />
    <path {...S} d="M30 22v62h48" />
    <path {...Sthin} d="M40 38h28M40 48h28M40 58h18" />
    <circle cx="86" cy="86" r="16" fill="#fff" {...S} />
    <path d="M79 86l5 5 10-11" fill="none" stroke={GOLD} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

/* Materials — stacked documents going into review */
const Documents = () => (
  <>
    <rect x="34" y="30" width="44" height="58" rx="5" {...S} transform="rotate(-6 56 59)" />
    <rect x="44" y="26" width="44" height="58" rx="5" fill="#fff" {...S} />
    <path {...Sthin} d="M53 40h26M53 50h26M53 60h16" />
    <path d="M53 72h12" stroke={GOLD} strokeWidth="3.2" strokeLinecap="round" />
    <circle cx="34" cy="92" r="3" fill={MINT} stroke="none" />
  </>
);

/* Readiness — summit flag on climbing contours */
const Summit = () => (
  <>
    <path {...S} d="M14 96c14 0 16-18 28-18s14 10 24 10 16-26 28-26 12 12 12 12" opacity=".5" />
    <path {...S} d="M62 84V34" />
    <path d="M62 34l26 8-26 8z" fill={GOLD} stroke={GOLD} strokeWidth="2" strokeLinejoin="round" />
    <path {...S} d="M30 104h60" />
    <circle cx="40" cy="60" r="2.4" fill={MINT} stroke="none" />
  </>
);

/* Peers — constellation of comparable companies */
const Constellation = () => (
  <>
    <path {...Sthin} d="M30 84 56 58l26 10 20-30" opacity=".7" />
    <circle cx="30" cy="84" r="6" {...S} />
    <circle cx="56" cy="58" r="8" fill="#fff" {...S} />
    <circle cx="82" cy="68" r="6" {...S} />
    <circle cx="102" cy="38" r="5" fill={GOLD} stroke="none" />
    <circle cx="44" cy="30" r="3" fill={MINT} stroke="none" />
    <path {...Sthin} d="M56 58 44 30" opacity=".5" />
  </>
);

/* Raise — rocket sized just right */
const Rocket = () => (
  <>
    <path {...S} d="M60 16c14 10 18 30 12 52H48c-6-22-2-42 12-52z" />
    <circle cx="60" cy="44" r="7" {...S} />
    <path {...S} d="M48 60 34 76l14-2M72 60l14 16-14-2" />
    <path d="M56 78c0 10 4 16 4 22 0-6 4-12 4-22z" fill={GOLD} stroke={GOLD} strokeWidth="1.6" strokeLinejoin="round" />
  </>
);

/* Valuation — balance scale over a range bar */
const Scales = () => (
  <>
    <path {...S} d="M60 22v56M40 30h40" />
    <path {...S} d="M40 30 30 52h20zM80 30 70 52h20z" />
    <path {...Sthin} d="M30 52a10 8 0 0 0 20 0M70 52a10 8 0 0 0 20 0" />
    <path {...S} d="M44 92h32" />
    <rect x="34" y="86" width="52" height="12" rx="6" {...Sthin} opacity=".45" />
    <rect x="46" y="86" width="28" height="12" rx="6" fill={GOLD} stroke="none" opacity=".9" />
  </>
);

/* Instruments — compass for choosing a route */
const Compass = () => (
  <>
    <circle cx="60" cy="60" r="34" {...S} />
    <circle cx="60" cy="60" r="3" fill="currentColor" stroke="none" />
    <path d="M60 60 76 40l-8 26z" fill={GOLD} stroke="none" />
    <path d="M60 60 44 80l8-26z" fill="currentColor" stroke="none" opacity=".55" />
    <path {...Sthin} d="M60 20v6M60 94v6M20 60h6M94 60h6" />
  </>
);

/* Blueprint / strategy — rolled map with route */
const Blueprint = () => (
  <>
    <path {...S} d="M26 34l24-8 20 8 24-8v60l-24 8-20-8-24 8z" />
    <path {...Sthin} d="M50 26v60M70 34v60" />
    <path d="M34 74c10-8 12-22 24-24s16 10 28-6" fill="none" stroke={GOLD} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="1 7" />
    <circle cx="86" cy="44" r="4" fill={GOLD} stroke="none" />
  </>
);

/* Story — fountain pen writing the narrative */
const Pen = () => (
  <>
    <path {...S} d="M78 22 98 42 52 88l-26 6 6-26z" />
    <path {...Sthin} d="M70 30l20 20" />
    <path {...S} d="M32 68l20 20" />
    <path d="M24 100c22 4 44 4 70-2" fill="none" stroke={GOLD} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="2 8" />
  </>
);

/* Teaser — envelope with a spark of interest */
const Envelope = () => (
  <>
    <rect x="24" y="38" width="72" height="50" rx="7" fill="#fff" {...S} />
    <path {...S} d="M26 42l34 26 34-26" />
    <path d="M97 26l2.6 6.4 6.4 2.6-6.4 2.6L97 44l-2.6-6.4L88 35l6.4-2.6z" fill={GOLD} stroke="none" />
  </>
);

/* Deck — easel with a slide */
const Easel = () => (
  <>
    <rect x="30" y="28" width="60" height="42" rx="5" fill="#fff" {...S} />
    <path {...Sthin} d="M38 60l12-12 9 7 14-16 9 9" stroke={GOLD} strokeWidth="2.6" />
    <path {...S} d="M60 70v14M60 84l-18 18M60 84l18 18M60 20v8" />
  </>
);

/* Model — ledger with growth line */
const Ledger = () => (
  <>
    <rect x="28" y="24" width="64" height="72" rx="7" fill="#fff" {...S} />
    <path {...Sthin} d="M28 42h64M50 42v54" />
    <path {...Sthin} d="M58 54h26M58 66h26M58 78h16" />
    <path d="M34 88V74m8 14V66m-16 22v-8" stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
  </>
);

/* IM — bound memorandum with seal */
const Memo = () => (
  <>
    <path {...S} d="M36 20h48v80H36a6 6 0 0 1-6-6V26a6 6 0 0 1 6-6z" />
    <path {...Sthin} d="M30 32h6M30 48h6M30 64h6M30 80h6" />
    <path {...Sthin} d="M48 40h26M48 50h26M48 60h18" />
    <circle cx="68" cy="82" r="9" fill="none" stroke={GOLD} strokeWidth="2.6" />
    <circle cx="68" cy="82" r="3.4" fill={GOLD} stroke="none" />
  </>
);

/* Review — magnifier finding a check */
const Magnifier = () => (
  <>
    <circle cx="54" cy="52" r="26" fill="#fff" {...S} />
    <path {...S} d="M74 72l24 24" />
    <path d="M44 52l7 8 15-16" fill="none" stroke={GOLD} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

/* Package / vault — the frozen investor package */
const Vault = () => (
  <>
    <rect x="26" y="26" width="68" height="62" rx="9" {...S} />
    <circle cx="60" cy="57" r="16" {...S} />
    <circle cx="60" cy="57" r="5" fill={GOLD} stroke="none" />
    <path {...Sthin} d="M60 41v6M60 67v6M44 57h6M70 57h6" />
    <path {...S} d="M36 88v10M84 88v10" />
  </>
);

/* Gate — friendly signpost lock */
const Gate = () => (
  <>
    <rect x="38" y="52" width="44" height="40" rx="8" fill="#fff" {...S} />
    <path {...S} d="M46 52V42a14 14 0 0 1 28 0v10" />
    <circle cx="60" cy="70" r="4.5" fill={GOLD} stroke="none" />
    <path {...S} d="M60 74v8" />
  </>
);

/* Spark — generic AI generation */
const Spark = () => (
  <>
    <path d="M60 24l7 20 20 7-20 7-7 20-7-20-20-7 20-7z" fill="none" {...S} />
    <path d="M92 68l3.4 8.6 8.6 3.4-8.6 3.4L92 92l-3.4-8.6L80 80l8.6-3.4z" fill={GOLD} stroke="none" />
    <circle cx="32" cy="88" r="3" fill={MINT} stroke="none" />
  </>
);

/* Handshake — approval */
const Handshake = () => (
  <>
    <path {...S} d="M16 48h14l14 26a10 10 0 0 0 14 4l4-3M104 48H90L74 70" />
    <path {...S} d="M52 46l14-6 18 8" />
    <path {...Sthin} d="M58 72l8 8M66 66l8 8" />
    <circle cx="60" cy="26" r="3" fill={GOLD} stroke="none" />
  </>
);

const LIB = {
  telescope: [Telescope, 'Market research'],
  fieldbook: [Fieldbook, 'Founder information'],
  documents: [Documents, 'Existing materials'],
  summit: [Summit, 'Readiness'],
  constellation: [Constellation, 'Peer universe'],
  rocket: [Rocket, 'Ideal raise'],
  scales: [Scales, 'Valuation'],
  compass: [Compass, 'Instruments'],
  blueprint: [Blueprint, 'Strategy blueprint'],
  pen: [Pen, 'Investment story'],
  envelope: [Envelope, 'Teaser'],
  easel: [Easel, 'Pitch deck'],
  ledger: [Ledger, 'Financial model'],
  memo: [Memo, 'Investment memorandum'],
  magnifier: [Magnifier, 'AI review'],
  vault: [Vault, 'Investor package'],
  gate: [Gate, 'Locked'],
  spark: [Spark, 'AI generation'],
  handshake: [Handshake, 'Approval'],
};

export function Illo({ name = 'spark', size = 96, className, style }) {
  const [Draw, label] = LIB[name] || LIB.spark;
  return (
    <span className={className} style={{ display: 'inline-flex', ...style }}>
      <Frame size={size} label={label}><Draw /></Frame>
    </span>
  );
}

/** Contour-line terrain motif — the fundraising journey as a map. For dark panels. */
export function Contours({ opacity = 0.14 }) {
  return (
    <svg className="contours" viewBox="0 0 900 360" preserveAspectRatio="xMidYMid slice" aria-hidden
      style={{ opacity }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} fill="none" stroke="#BFE3D2" strokeWidth="1.1"
          d={`M-40 ${300 - i * 34} C 140 ${230 - i * 30}, 240 ${330 - i * 40}, 430 ${250 - i * 34} S 760 ${300 - i * 26}, 960 ${190 - i * 30}`} />
      ))}
      <circle cx="712" cy="96" r="4" fill="#C8A24B" />
      <path d="M712 96v-26l20 6-20 6" fill="none" stroke="#C8A24B" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
