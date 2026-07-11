import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BANK,
  Game,
  RESOURCES,
  RESOURCE_LABEL,
  Resource,
  ResourceBag,
  TxnKind,
  bagIsEmpty,
  bagTotal,
  emptyBag,
  formatBag,
  handOf,
  isBank,
  partyName,
} from './types';

export interface MovePreset {
  from?: string;
  to?: string;
  bag?: ResourceBag;
  title?: string;
  // Extra one-way flavor when the modal is used for gains from the bank
  // vs. discards/spends back to it.
  kind?: TxnKind;
}

interface Props {
  open: boolean;
  game: Game;
  preset: MovePreset;
  lockFrom?: boolean;
  onClose: () => void;
  onSend: (txn: {
    from: string;
    to: string;
    resources: ResourceBag;
    kind: TxnKind;
    note: string;
  }) => void;
}

const inferKind = (from: string, to: string): TxnKind => {
  if (isBank(from) && !isBank(to)) return 'gain';
  if (!isBank(from) && isBank(to)) return 'spend';
  return 'trade';
};

const PartyPicker = ({
  game,
  value,
  exclude,
  onChange,
  label,
}: {
  game: Game;
  value: string;
  exclude?: string;
  onChange: (v: string) => void;
  label: string;
}) => (
  <label className="field">
    <span>{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value={BANK} disabled={exclude === BANK}>
        Bank
      </option>
      {game.players.map((p) => (
        <option key={p.id} value={p.id} disabled={exclude === p.id}>
          {p.name} · {bagTotal(handOf(game, p.id))} cards
        </option>
      ))}
    </select>
  </label>
);

export const ResourceMoveModal = ({
  open,
  game,
  preset,
  lockFrom = false,
  onClose,
  onSend,
}: Props) => {
  const defaultFrom =
    preset.from ?? (game.players[0] ? game.players[0].id : BANK);
  const defaultTo =
    preset.to ??
    (game.players.find((p) => p.id !== defaultFrom)?.id ?? BANK);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [bag, setBag] = useState<ResourceBag>(preset.bag ?? emptyBag());
  const [note, setNote] = useState('');
  const firstStepperRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setFrom(preset.from ?? (game.players[0] ? game.players[0].id : BANK));
    setTo(
      preset.to ??
        (game.players.find((p) => p.id !== (preset.from ?? game.players[0]?.id))
          ?.id ??
          BANK),
    );
    setBag(preset.bag ?? emptyBag());
    setNote('');
    window.setTimeout(() => firstStepperRef.current?.focus(), 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset.from, preset.to, preset.bag]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const kind = useMemo(() => preset.kind ?? inferKind(from, to), [from, to, preset.kind]);
  const sameParty = from === to;
  const valid = !bagIsEmpty(bag) && !sameParty;

  const verb = useMemo(() => {
    if (preset.title) return preset.title;
    if (kind === 'gain') return 'Deal from bank';
    if (kind === 'spend') return 'Return to bank';
    if (kind === 'discard') return 'Discard';
    if (kind === 'steal') return 'Steal';
    return 'Trade';
  }, [kind, preset.title]);

  if (!open) return null;

  const bump = (r: Resource, delta: number) => {
    setBag((cur) => ({ ...cur, [r]: Math.max(0, (cur[r] ?? 0) + delta) }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSend({ from, to, resources: bag, kind, note: note.trim() });
    onClose();
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
      <form className="modal panel send-modal" onSubmit={submit}>
        <h2 className="modal-title">{verb}</h2>
        <div className="modal-body">
          <div className="send-parties">
            {lockFrom ? (
              <div className="field send-from-locked">
                <span>From</span>
                <div className="send-from-locked-value">
                  {partyName(game, from)}
                </div>
              </div>
            ) : (
              <PartyPicker
                game={game}
                value={from}
                exclude={to}
                onChange={setFrom}
                label="From"
              />
            )}
            {!lockFrom && (
              <button
                type="button"
                className="swap-btn"
                aria-label="Swap sender and recipient"
                onClick={() => {
                  setFrom(to);
                  setTo(from);
                }}
              >
                ⇅
              </button>
            )}
            <PartyPicker
              game={game}
              value={to}
              exclude={from}
              onChange={setTo}
              label="To"
            />
          </div>

          <ul className="resource-steppers">
            {RESOURCES.map((r, i) => (
              <li key={r} className={`resource-stepper res-${r}`}>
                <span className="resource-stepper-swatch" aria-hidden="true" />
                <span className="resource-stepper-label">{RESOURCE_LABEL[r]}</span>
                <div className="resource-stepper-controls">
                  <button
                    ref={i === 0 ? firstStepperRef : undefined}
                    type="button"
                    aria-label={`Remove one ${RESOURCE_LABEL[r]}`}
                    onClick={() => bump(r, -1)}
                    disabled={(bag[r] ?? 0) <= 0}
                  >
                    −
                  </button>
                  <span className="resource-stepper-count">{bag[r] ?? 0}</span>
                  <button
                    type="button"
                    aria-label={`Add one ${RESOURCE_LABEL[r]}`}
                    onClick={() => bump(r, 1)}
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <label className="field">
            <span>Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. paid Alice for a wool trade"
              autoComplete="off"
              maxLength={120}
            />
          </label>

          {sameParty && (
            <p className="pin-error">Pick two different parties.</p>
          )}
          {valid && (
            <p className="send-preview muted small">
              {partyName(game, from)} → {partyName(game, to)}: {formatBag(bag)}
            </p>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!valid}>
            {verb}
          </button>
        </div>
      </form>
    </div>
  );
};
