interface IconProps {
  size?: number;
  className?: string;
}

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
