import type { Resource } from './types';

interface IconProps {
  size?: number;
  className?: string;
}

interface ArtProps {
  size?: number;
}

// The five Catan resource illustrations. Each fills its viewBox so it can
// sit inside a card tile with any tinted background — no baked-in
// backdrop rectangle to fight the tile.

// Brick — a stack of three staggered clay bricks with mortar seams.
export const BrickArt = ({ size = 48 }: ArtProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <g>
      <rect x="6" y="12" width="16" height="8" rx="1.6" fill="#c94a2b" />
      <rect x="24" y="12" width="18" height="8" rx="1.6" fill="#c94a2b" />
      <rect x="6" y="22" width="20" height="8" rx="1.6" fill="#d05a3c" />
      <rect x="28" y="22" width="14" height="8" rx="1.6" fill="#d05a3c" />
      <rect x="6" y="32" width="14" height="8" rx="1.6" fill="#b6421f" />
      <rect x="22" y="32" width="20" height="8" rx="1.6" fill="#b6421f" />
    </g>
    <g stroke="#6d2716" strokeWidth="1.2" opacity="0.35">
      <line x1="22" y1="12" x2="22" y2="20" />
      <line x1="26" y1="22" x2="26" y2="30" />
      <line x1="20" y1="32" x2="20" y2="40" />
    </g>
  </svg>
);

// Lumber — a stack of end-view logs with growth rings.
export const LumberArt = ({ size = 48 }: ArtProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <g stroke="#2a4f14" strokeWidth="1.2" fill="none">
      <circle cx="16" cy="18" r="9" fill="#8a5a2b" />
      <circle cx="16" cy="18" r="5.5" />
      <circle cx="16" cy="18" r="2.5" />
      <circle cx="32" cy="18" r="9" fill="#8a5a2b" />
      <circle cx="32" cy="18" r="5.5" />
      <circle cx="32" cy="18" r="2.5" />
      <circle cx="24" cy="34" r="9" fill="#9d6b34" />
      <circle cx="24" cy="34" r="5.5" />
      <circle cx="24" cy="34" r="2.5" />
    </g>
    <g fill="#3a6a1e">
      <path d="M8 8 q3 -2 6 0 q-1 3 -3 4 z" />
      <path d="M34 8 q3 -2 6 0 q-1 3 -3 4 z" />
    </g>
  </svg>
);

// Wool — a woolly sheep head with black ears and a face.
export const WoolArt = ({ size = 48 }: ArtProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <g fill="#f4f0dd">
      <circle cx="24" cy="24" r="14" />
      <circle cx="12" cy="18" r="5" />
      <circle cx="36" cy="18" r="5" />
      <circle cx="14" cy="28" r="5" />
      <circle cx="34" cy="28" r="5" />
      <circle cx="24" cy="12" r="5" />
      <circle cx="24" cy="36" r="5" />
    </g>
    <g fill="#3e342a">
      <ellipse cx="16" cy="14" rx="2" ry="3" transform="rotate(-25 16 14)" />
      <ellipse cx="32" cy="14" rx="2" ry="3" transform="rotate(25 32 14)" />
    </g>
    <g fill="#faf6e5">
      <ellipse cx="24" cy="26" rx="8" ry="7" />
    </g>
    <g fill="#3e342a">
      <circle cx="21" cy="24" r="1.3" />
      <circle cx="27" cy="24" r="1.3" />
      <path d="M22 30 q2 1 4 0" stroke="#3e342a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </g>
  </svg>
);

// Grain — a wheat sheaf, three rows of kernels on curving stalks.
export const GrainArt = ({ size = 48 }: ArtProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <g stroke="#7a5a10" strokeWidth="1.4" fill="none" strokeLinecap="round">
      <path d="M24 42 C 22 30 20 22 16 12" />
      <path d="M24 42 C 24 30 24 20 24 10" />
      <path d="M24 42 C 26 30 28 22 32 12" />
    </g>
    <g fill="#e9b23f" stroke="#7a5a10" strokeWidth="0.6">
      {/* left stalk kernels */}
      <ellipse cx="15" cy="14" rx="3" ry="2" transform="rotate(-20 15 14)" />
      <ellipse cx="17" cy="19" rx="3" ry="2" transform="rotate(-15 17 19)" />
      <ellipse cx="18.5" cy="24" rx="3" ry="2" transform="rotate(-10 18.5 24)" />
      {/* center */}
      <ellipse cx="24" cy="12" rx="3" ry="2" />
      <ellipse cx="24" cy="17" rx="3" ry="2" />
      <ellipse cx="24" cy="22" rx="3" ry="2" />
      {/* right stalk kernels */}
      <ellipse cx="33" cy="14" rx="3" ry="2" transform="rotate(20 33 14)" />
      <ellipse cx="31" cy="19" rx="3" ry="2" transform="rotate(15 31 19)" />
      <ellipse cx="29.5" cy="24" rx="3" ry="2" transform="rotate(10 29.5 24)" />
    </g>
    <path d="M20 42 h8" stroke="#7a5a10" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

// Ore — an angular chunk of rock with facet highlights.
export const OreArt = ({ size = 48 }: ArtProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <g>
      <path d="M8 32 L16 12 L32 10 L42 22 L38 38 L20 42 Z"
            fill="#6c757d" stroke="#3e444a" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M16 12 L24 22 L32 10 Z" fill="#8a939b" />
      <path d="M24 22 L38 38 L42 22 Z" fill="#7d868d" />
      <path d="M8 32 L24 22 L20 42 Z" fill="#5b636a" />
    </g>
    <g fill="#c9d1d7" opacity="0.7">
      <circle cx="22" cy="20" r="1.4" />
      <circle cx="34" cy="18" r="1.2" />
      <circle cx="14" cy="26" r="1" />
    </g>
  </svg>
);

const RESOURCE_ART: Record<Resource, (props: ArtProps) => JSX.Element> = {
  brick: BrickArt,
  lumber: LumberArt,
  wool: WoolArt,
  grain: GrainArt,
  ore: OreArt,
};

export const ResourceArt = ({
  resource,
  size = 48,
}: {
  resource: Resource;
  size?: number;
}) => {
  const Art = RESOURCE_ART[resource];
  return <Art size={size} />;
};

// A simple banknote glyph used as the app mark.
export const BillIcon = ({ size = 22, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.4" />
    <path d="M6 9v0M18 15v0" />
  </svg>
);

export const ArrowIcon = ({ size = 18, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const ScrewIcon = ({ size = 22 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="2.5" width="18" height="3" rx="0.6" fill="currentColor" stroke="none" />
    <line x1="8" y1="6" x2="8" y2="16.5" />
    <line x1="16" y1="6" x2="16" y2="16.5" />
    <polyline points="8,8.5 16,10 8,11.5 16,13 8,14.5 16,16" />
    <polyline points="8,16.5 12,21 16,16.5" />
  </svg>
);

// A pointy-top hexagon, the app mark. Matches the Catan hex tile shape.
export const ClubIcon = ({ size = 22, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="7" r="3.4" />
    <circle cx="7.5" cy="13" r="3.4" />
    <circle cx="16.5" cy="13" r="3.4" />
    <path d="M10.5 20 c0.7-2.5 1-3.5 1.5-5.5 0.5 2 0.8 3 1.5 5.5 z" />
  </svg>
);

export const HexIcon = ({ size = 22, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
  </svg>
);

export const BankIcon = ({ size = 20, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3 10l9-6 9 6" />
    <path d="M5 10v8M19 10v8M9 10v8M15 10v8" />
    <path d="M3 20h18" />
  </svg>
);
