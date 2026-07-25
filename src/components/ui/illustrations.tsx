/**
 * Empty-state illustrations.
 *
 * Hand-drawn inline SVG rather than an icon set or an image: they carry the
 * brand pink, inherit the current theme through CSS variables, weigh almost
 * nothing, and stay crisp at any size. An empty screen is the moment a new
 * user decides whether this thing feels cared for.
 */

type Props = { className?: string };

const PINK = "#EF3A5D";
const LEMON = "#D5FE00";

/** Clear queue — a checklist with everything ticked. */
export function AllClearIllustration({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} fill="none" role="img" aria-label="">
      <rect x="34" y="18" width="92" height="88" rx="10" fill="var(--surface-sunken)" />
      <rect x="34" y="18" width="92" height="88" rx="10" stroke="var(--border-subtle)" strokeWidth="2" />
      {[38, 60, 82].map((y, i) => (
        <g key={y}>
          <rect x="48" y={y} width="16" height="16" rx="5" fill={PINK} opacity={1 - i * 0.22} />
          <path
            d={`M52.5 ${y + 8.5} l3 3 5.5 -6`}
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="72" y={y + 4} width={44 - i * 10} height="7" rx="3.5" fill="var(--border-subtle)" />
        </g>
      ))}
      <circle cx="126" cy="30" r="9" fill={LEMON} />
      <path d="M122 30 l3 3 5.5 -6" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** No events — a calendar with a spark on the date. */
export function NoEventsIllustration({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} fill="none" role="img" aria-label="">
      <rect x="28" y="26" width="104" height="80" rx="10" fill="var(--surface-sunken)" />
      <rect x="28" y="26" width="104" height="80" rx="10" stroke="var(--border-subtle)" strokeWidth="2" />
      <path d="M28 48 h104" stroke="var(--border-subtle)" strokeWidth="2" />
      <rect x="48" y="16" width="7" height="20" rx="3.5" fill={PINK} />
      <rect x="105" y="16" width="7" height="20" rx="3.5" fill={PINK} />
      {[0, 1, 2, 3].map((col) =>
        [0, 1, 2].map((row) => (
          <rect
            key={`${col}-${row}`}
            x={44 + col * 20}
            y={60 + row * 16}
            width="12"
            height="8"
            rx="3"
            fill="var(--border-subtle)"
          />
        ))
      )}
      <circle cx="106" cy="80" r="12" fill={PINK} />
      <path d="M106 74 v12 M100 80 h12" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Nothing to approve — an inbox at rest. */
export function NoApprovalsIllustration({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} fill="none" role="img" aria-label="">
      <path
        d="M32 62 L48 30 h64 l16 32 v30 a8 8 0 0 1 -8 8 H40 a8 8 0 0 1 -8 -8z"
        fill="var(--surface-sunken)"
        stroke="var(--border-subtle)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M32 62 h26 l6 12 h32 l6 -12 h26"
        stroke="var(--border-subtle)"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="80" cy="44" r="13" fill={PINK} />
      <path d="M74 44 l4 4 8 -8.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Blank month — a page waiting to be written on. */
export function BlankPageIllustration({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} fill="none" role="img" aria-label="">
      <rect x="44" y="16" width="72" height="90" rx="8" fill="var(--surface-sunken)" />
      <rect x="44" y="16" width="72" height="90" rx="8" stroke="var(--border-subtle)" strokeWidth="2" />
      {[36, 50, 64].map((y, i) => (
        <rect key={y} x="58" y={y} width={44 - i * 8} height="6" rx="3" fill="var(--border-subtle)" />
      ))}
      {/* A pen mid-stroke: the page is about to be filled, not abandoned. */}
      <path d="M96 92 l22 -22 8 8 -22 22 -10 2z" fill={PINK} />
      <path d="M118 70 l4 -4 8 8 -4 4z" fill="#111" opacity=".85" />
      <circle cx="60" cy="92" r="5" fill={LEMON} />
    </svg>
  );
}

/** Nothing in the library — stacked, sorted, waiting. */
export function EmptyLibraryIllustration({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} fill="none" role="img" aria-label="">
      <rect x="26" y="44" width="42" height="54" rx="8" fill="var(--surface-sunken)" stroke="var(--border-subtle)" strokeWidth="2" />
      <rect x="74" y="30" width="42" height="68" rx="8" fill="var(--surface-sunken)" stroke="var(--border-subtle)" strokeWidth="2" />
      <rect x="122" y="56" width="14" height="42" rx="6" fill="var(--surface-sunken)" stroke="var(--border-subtle)" strokeWidth="2" />
      <circle cx="95" cy="52" r="9" fill={PINK} />
      <rect x="82" y="70" width="26" height="6" rx="3" fill="var(--border-subtle)" />
      <rect x="36" y="62" width="22" height="6" rx="3" fill="var(--border-subtle)" />
      <rect x="36" y="76" width="14" height="6" rx="3" fill="var(--border-subtle)" />
    </svg>
  );
}
