import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BANK,
  COST_CITY,
  COST_DEV_CARD,
  COST_ROAD,
  COST_SETTLEMENT,
  Game,
  Player,
  RESOURCES,
  RESOURCE_LABEL,
  ResourceBag,
  Txn,
  TxnKind,
  bagTotal,
  bankerOf,
  canAfford,
  emptyBag,
  formatBag,
  handOf,
  handSize,
  isBank,
  isBankerUser,
  newId,
  normalizeName,
  partyName,
} from '../types';
import { useConfirm } from '../ConfirmDialog';
import { navigate } from '../App';
import { MovePreset, ResourceMoveModal } from '../ResourceMoveModal';
import { ArrowIcon, BankIcon } from '../icons';

interface Props {
  game: Game;
  currentUser: string;
  onAddTxn: (txn: {
    from: string;
    to: string;
    resources: ResourceBag;
    kind: TxnKind;
    note: string;
  }) => void;
  onRemoveTxn: (txnId: string) => void;
  onUpdatePlayers: (players: Player[]) => void;
  onTransferBanker: (banker: string) => void;
  onEndGame: () => void;
  onReopenGame: () => void;
  onDeleteGame: () => void;
}

const txnTime = (ts: number): string =>
  new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const BUILDS: {
  key: 'road' | 'settlement' | 'city' | 'dev';
  label: string;
  cost: ResourceBag;
  note: string;
}[] = [
  { key: 'road', label: 'Road', cost: COST_ROAD, note: 'Built a road' },
  {
    key: 'settlement',
    label: 'Settlement',
    cost: COST_SETTLEMENT,
    note: 'Built a settlement',
  },
  { key: 'city', label: 'City', cost: COST_CITY, note: 'Upgraded to a city' },
  {
    key: 'dev',
    label: 'Dev card',
    cost: COST_DEV_CARD,
    note: 'Bought a development card',
  },
];

export const GameView = ({
  game,
  currentUser,
  onAddTxn,
  onRemoveTxn,
  onUpdatePlayers,
  onTransferBanker,
  onEndGame,
  onReopenGame,
  onDeleteGame,
}: Props) => {
  const confirm = useConfirm();
  const myKey = normalizeName(currentUser);
  const me = useMemo(
    () => game.players.find((p) => normalizeName(p.name) === myKey) ?? null,
    [game.players, myKey],
  );
  const banker = bankerOf(game);
  const iAmBanker = isBankerUser(game, currentUser);

  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [move, setMove] = useState<MovePreset | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const ended = game.endedAt !== null;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const sortedPlayers = useMemo(
    () =>
      [...game.players].sort((a, b) => handSize(game, b.id) - handSize(game, a.id)),
    [game],
  );

  const recentTxns = useMemo(
    () => [...game.txns].sort((a, b) => b.createdAt - a.createdAt),
    [game.txns],
  );

  const myHand = me ? handOf(game, me.id) : emptyBag();
  const myTotal = bagTotal(myHand);

  const [pop, setPop] = useState(false);
  const prevTotalRef = useRef<number | null>(null);
  useEffect(() => {
    if (!me) {
      prevTotalRef.current = null;
      return;
    }
    if (prevTotalRef.current === null) {
      prevTotalRef.current = myTotal;
      return;
    }
    const diff = myTotal - prevTotalRef.current;
    prevTotalRef.current = myTotal;
    if (diff <= 0) return;
    setPop(true);
    const t = window.setTimeout(() => setPop(false), 650);
    return () => window.clearTimeout(t);
  }, [myTotal, me]);

  const spend = (playerId: string, cost: ResourceBag, note: string) => {
    if (!canAfford(game, playerId, cost)) return;
    onAddTxn({
      from: playerId,
      to: BANK,
      resources: cost,
      kind: 'spend',
      note,
    });
  };

  const handleDeleteTxn = async (t: Txn) => {
    const ok = await confirm({
      title: 'Undo this transaction?',
      body: (
        <p className="muted">
          {partyName(game, t.from)} → {partyName(game, t.to)}: {formatBag(t.resources)}.
          Hands will be recalculated.
        </p>
      ),
      confirmLabel: 'Undo',
      danger: true,
    });
    if (ok) onRemoveTxn(t.id);
  };

  const handleEnd = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: 'End this game?',
      body: <p className="muted">Final hands stay visible. You can reopen it later.</p>,
      confirmLabel: 'End game',
    });
    if (ok) onEndGame();
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: 'Delete this game?',
      body: (
        <p className="muted">
          <strong>{game.name}</strong> and its whole log will be gone for good.
        </p>
      ),
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) onDeleteGame();
  };

  return (
    <div className="game-view">
      <div className="game-top">
        <button className="link-back" onClick={() => navigate('/')}>
          ← Games
        </button>
        {iAmBanker && (
          <div className="game-menu" ref={menuRef}>
            <button
              className="icon-btn"
              aria-label="Game menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="menu-pop panel" role="menu">
                {!ended && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setTransferOpen(true);
                    }}
                  >
                    Transfer banker
                  </button>
                )}
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditOpen(true);
                  }}
                >
                  Edit players
                </button>
                {ended ? (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onReopenGame();
                    }}
                  >
                    Reopen game
                  </button>
                ) : (
                  <button role="menuitem" onClick={handleEnd}>
                    End game
                  </button>
                )}
                <button role="menuitem" className="danger" onClick={handleDelete}>
                  Delete game
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="game-header">
        <h1>{game.name}</h1>
        {ended && <span className="badge">Ended</span>}
      </div>

      {me ? (
        <div className="my-balance panel">
          <div className="my-balance-label muted">
            Your hand
            {iAmBanker && <span className="banker-badge-inline">Banker</span>}
          </div>
          <div className={`my-balance-amount ${pop ? 'pop' : ''}`}>
            {myTotal}
            <span className="my-balance-suffix"> cards</span>
          </div>
          <ul className="my-hand-chips" aria-label="Your resource cards">
            {RESOURCES.map((r) => (
              <li key={r} className={`hand-chip res-${r}`}>
                <span className="hand-chip-swatch" aria-hidden="true" />
                <span className="hand-chip-count">{myHand[r]}</span>
                <span className="hand-chip-label">{RESOURCE_LABEL[r]}</span>
              </li>
            ))}
          </ul>
          {!ended && (
            <div className="my-actions">
              {BUILDS.map((b) => {
                const affordable = canAfford(game, me.id, b.cost);
                return (
                  <button
                    key={b.key}
                    type="button"
                    className="ghost build-btn"
                    disabled={!affordable}
                    onClick={() => spend(me.id, b.cost, b.note)}
                  >
                    <span className="build-btn-label">{b.label}</span>
                    <span className="build-btn-cost">{formatBag(b.cost)}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className="primary trade-btn"
                onClick={() => setMove({ from: me.id })}
              >
                <ArrowIcon size={16} /> Trade / move cards
              </button>
              {iAmBanker && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setMove({ from: BANK, to: me.id, kind: 'gain' })}
                >
                  <BankIcon size={16} /> Deal from bank
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        !ended && (
          <div className="panel muted small banker-note">
            Signed in as <strong>{currentUser}</strong> — you're not a player in
            this game. Sign in with your player name to interact.
            {banker && (
              <>
                {' '}
                The banker is <strong>{banker.name}</strong>.
              </>
            )}
          </div>
        )
      )}

      <div className="players-section">
        <div className="section-row">
          <h2 className="section-label muted">Players</h2>
        </div>
        <ul className="balance-list">
          {sortedPlayers.map((p) => {
            const hand = handOf(game, p.id);
            const total = bagTotal(hand);
            const isMe = me?.id === p.id;
            const isBankerRow = banker?.id === p.id;
            return (
              <li key={p.id} className={`balance-row ${isMe ? 'me' : ''}`}>
                <span className="balance-avatar" aria-hidden="true">
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span className="balance-name">
                  {p.name}
                  {isMe && <span className="muted small"> (you)</span>}
                  {isBankerRow && <span className="banker-badge">Banker</span>}
                </span>
                <span className="balance-hand-summary muted small">
                  {formatBag(hand)}
                </span>
                <span className="balance-amount">{total}</span>
                {!ended && iAmBanker && !isMe && (
                  <button
                    type="button"
                    className="pay-btn"
                    aria-label={`Move cards involving ${p.name}`}
                    onClick={() => setMove({ from: BANK, to: p.id, kind: 'gain' })}
                  >
                    Deal
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="log-section">
        <h2 className="section-label muted">Move log</h2>
        {recentTxns.length === 0 ? (
          <p className="muted small">No moves yet.</p>
        ) : (
          <ul className="txn-list">
            {recentTxns.map((t) => (
              <li key={t.id} className="txn-row">
                <div className="txn-main">
                  <span className="txn-parties">
                    <span className={isBank(t.from) ? 'party-bank' : ''}>
                      {partyName(game, t.from)}
                    </span>
                    <ArrowIcon size={14} className="txn-arrow" />
                    <span className={isBank(t.to) ? 'party-bank' : ''}>
                      {partyName(game, t.to)}
                    </span>
                  </span>
                  {t.note && <span className="txn-note muted small">{t.note}</span>}
                </div>
                <span className="txn-amount">{formatBag(t.resources)}</span>
                <span className="txn-time muted small">{txnTime(t.createdAt)}</span>
                {!ended && iAmBanker && (
                  <button
                    className="icon-btn danger txn-undo"
                    aria-label="Undo transaction"
                    onClick={() => handleDeleteTxn(t)}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ResourceMoveModal
        open={move !== null}
        game={game}
        preset={move ?? {}}
        lockFrom={!iAmBanker}
        onClose={() => setMove(null)}
        onSend={onAddTxn}
      />

      {editOpen && (
        <PlayersEditor
          game={game}
          onClose={() => setEditOpen(false)}
          onSave={(players) => {
            onUpdatePlayers(players);
            setEditOpen(false);
          }}
        />
      )}

      {transferOpen && banker && (
        <TransferBankerModal
          game={game}
          currentBanker={banker}
          onClose={() => setTransferOpen(false)}
          onTransfer={(playerId) => {
            onTransferBanker(playerId);
            setTransferOpen(false);
          }}
        />
      )}
    </div>
  );
};

const TransferBankerModal = ({
  game,
  currentBanker,
  onClose,
  onTransfer,
}: {
  game: Game;
  currentBanker: Player;
  onClose: () => void;
  onTransfer: (playerId: string) => void;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const others = game.players.filter((p) => p.id !== currentBanker.id);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal panel">
        <h2 className="modal-title">Transfer banker</h2>
        <div className="modal-body">
          <p className="muted small">
            You'll lose the ability to deal from the bank, move other players'
            cards, or resolve the robber.
          </p>
          {others.length === 0 ? (
            <p className="muted small">
              You're the only player. Add someone else first from{' '}
              <em>Edit players</em>.
            </p>
          ) : (
            <ul className="award-list">
              {others.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="award-row"
                    onClick={() => onTransfer(p.id)}
                  >
                    <span className="balance-avatar" aria-hidden="true">
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="balance-name">{p.name}</span>
                    <span className="award-give">Make banker</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const PlayersEditor = ({
  game,
  onClose,
  onSave,
}: {
  game: Game;
  onClose: () => void;
  onSave: (players: Player[]) => void;
}) => {
  const [players, setPlayers] = useState<Player[]>(game.players);
  const [draft, setDraft] = useState('');

  const usedIds = useMemo(() => {
    const s = new Set<string>();
    for (const t of game.txns) {
      if (!isBank(t.from)) s.add(t.from);
      if (!isBank(t.to)) s.add(t.to);
    }
    return s;
  }, [game.txns]);

  const add = () => {
    const nm = draft.trim();
    if (!nm) return;
    if (players.some((p) => normalizeName(p.name) === normalizeName(nm))) {
      setDraft('');
      return;
    }
    setPlayers((cur) => [...cur, { id: newId(), name: nm }]);
    setDraft('');
  };

  const remove = (id: string) => {
    if (usedIds.has(id)) return;
    setPlayers((cur) => cur.filter((p) => p.id !== id));
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal panel">
        <h2 className="modal-title">Edit players</h2>
        <div className="modal-body">
          <ul className="player-chips">
            {players.map((p) => (
              <li key={p.id} className="player-chip">
                <span className="player-chip-avatar">
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span className="player-chip-name">{p.name}</span>
                <button
                  type="button"
                  className="player-chip-x"
                  aria-label={`Remove ${p.name}`}
                  disabled={usedIds.has(p.id)}
                  title={
                    usedIds.has(p.id)
                      ? 'This player already has moves and cannot be removed'
                      : undefined
                  }
                  onClick={() => remove(p.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="add-player">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="Add a player…"
              autoComplete="off"
            />
            <button type="button" className="ghost" onClick={add} disabled={!draft.trim()}>
              Add
            </button>
          </div>
          <p className="muted small">
            Players with moves in the log can't be removed.
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => onSave(players)}
            disabled={players.length < 2}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

