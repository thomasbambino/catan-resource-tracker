import { ReactNode, useEffect, useRef, useState } from 'react';
import { BillIcon, HexIcon, ScrewIcon } from './icons';

type GameKey = 'catan' | 'monopoly' | 'konkan' | 'screw';

interface GameDef {
  key: GameKey;
  label: string;
  symbol: ReactNode;
  url: string;
}

const CATAN_URL =
  (import.meta.env.VITE_CATAN_URL as string | undefined) ||
  'https://catan.stylus.services';
const MONOPOLY_URL =
  (import.meta.env.VITE_MONOPOLY_URL as string | undefined) ||
  'https://monopoly.stylus.services';
const KONKAN_URL =
  (import.meta.env.VITE_KONKAN_URL as string | undefined) ||
  'https://konkan.stylus.services';
const SCREW_URL =
  (import.meta.env.VITE_SCREW_URL as string | undefined) ||
  'https://screw.stylus.services';

const GAMES: GameDef[] = [
  { key: 'catan', label: 'Catan Resource Tracker', symbol: <HexIcon size={22} />, url: CATAN_URL },
  { key: 'monopoly', label: 'Monopoly Banker', symbol: <BillIcon size={22} />, url: MONOPOLY_URL },
  { key: 'konkan', label: 'Konkan', symbol: '♣', url: KONKAN_URL },
  { key: 'screw', label: 'Screw Your Neighbor', symbol: <ScrewIcon size={22} />, url: SCREW_URL },
];

export const GameSwitcher = ({ current }: { current: GameKey }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const here = GAMES.find((g) => g.key === current) ?? GAMES[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (g: GameDef) => {
    setOpen(false);
    if (g.key === current) return;
    window.location.href = g.url;
  };

  return (
    <div className="game-switcher" ref={rootRef}>
      <button
        type="button"
        className="title-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="logo">{here.symbol}</span>
        <span className="title-word">
          {here.key === 'screw'
            ? 'Screw'
            : here.key === 'catan'
              ? 'Catan'
              : here.label}
        </span>
        <span className={`switcher-chev ${open ? 'open' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="switcher-menu panel" role="menu">
          {GAMES.map((g) => (
            <button
              key={g.key}
              type="button"
              role="menuitem"
              className={`switcher-item ${g.key === current ? 'on' : ''}`}
              onClick={() => go(g)}
            >
              <span className="switcher-symbol" aria-hidden="true">{g.symbol}</span>
              <span className="switcher-label">{g.label}</span>
              {g.key === current && <span className="switcher-here">Here</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
