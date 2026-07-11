import { useEffect, useMemo, useRef, useState } from 'react';
import { KnownPlayer, Player, newId, normalizeName } from '../types';

interface Props {
  knownPlayers: KnownPlayer[];
  allPlayers: KnownPlayer[];
  currentUser: string;
  onCreate: (name: string, players: Player[], banker: string) => void;
  onCancel: () => void;
}

export const NewGameView = ({
  knownPlayers,
  allPlayers,
  currentUser,
  onCreate,
  onCancel,
}: Props) => {
  const [name, setName] = useState('');
  const [players, setPlayers] = useState<Player[]>(() => [
    { id: newId(), name: currentUser.trim() },
  ]);
  const [banker, setBanker] = useState<string>(() => players[0]?.id ?? '');
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (players.length === 0) {
      if (banker) setBanker('');
      return;
    }
    if (!players.some((p) => p.id === banker)) {
      setBanker(players[0].id);
    }
  }, [players, banker]);

  const suggestionPool = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const p of allPlayers) byKey.set(p.key, p.name);
    for (const p of knownPlayers) byKey.set(p.key, p.name);
    return byKey;
  }, [knownPlayers, allPlayers]);

  const takenKeys = useMemo(
    () => new Set(players.map((p) => normalizeName(p.name))),
    [players],
  );

  const suggestions = useMemo(() => {
    const q = normalizeName(draft);
    const out: string[] = [];
    for (const [key, nm] of suggestionPool) {
      if (takenKeys.has(key)) continue;
      if (q && !key.includes(q)) continue;
      out.push(nm);
      if (out.length >= 6) break;
    }
    return out;
  }, [draft, suggestionPool, takenKeys]);

  const addPlayer = (raw: string) => {
    const nm = raw.trim();
    if (!nm) return;
    if (takenKeys.has(normalizeName(nm))) {
      setDraft('');
      return;
    }
    setPlayers((cur) => [...cur, { id: newId(), name: nm }]);
    setDraft('');
    inputRef.current?.focus();
  };

  const removePlayer = (id: string) => {
    setPlayers((cur) => cur.filter((p) => p.id !== id));
  };

  const canCreate =
    players.length >= 2 && players.some((p) => p.id === banker);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.trim()) {
      const nm = draft.trim();
      const next = takenKeys.has(normalizeName(nm))
        ? players
        : [...players, { id: newId(), name: nm }];
      if (next.length < 2) return;
      const chosen = next.find((p) => p.id === banker)?.id ?? next[0].id;
      onCreate(name, next, chosen);
      return;
    }
    if (!canCreate) return;
    onCreate(name, players, banker);
  };

  return (
    <form className="new-game panel" onSubmit={submit}>
      <div className="view-head">
        <h1>New game</h1>
      </div>

      <label className="field">
        <span>Game name (optional)</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sunday Catan"
          autoComplete="off"
        />
      </label>

      <div className="field">
        <span>Players</span>
        <ul className="player-chips">
          {players.map((p) => (
            <li key={p.id} className="player-chip">
              <span className="player-chip-avatar">
                {p.name.charAt(0).toUpperCase()}
              </span>
              <span className="player-chip-name">
                {p.name}
                {normalizeName(p.name) === normalizeName(currentUser) && (
                  <span className="muted small"> (you)</span>
                )}
              </span>
              <button
                type="button"
                className="player-chip-x"
                aria-label={`Remove ${p.name}`}
                onClick={() => removePlayer(p.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <div className="add-player">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addPlayer(draft);
              }
            }}
            placeholder="Add a player…"
            autoComplete="off"
          />
          <button
            type="button"
            className="ghost"
            onClick={() => addPlayer(draft)}
            disabled={!draft.trim()}
          >
            Add
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map((nm) => (
              <button
                type="button"
                key={nm}
                className="chip"
                onClick={() => addPlayer(nm)}
              >
                {nm}
              </button>
            ))}
          </div>
        )}
      </div>

      {players.length >= 1 && (
        <div className="field">
          <span>Banker</span>
          <ul className="banker-picker">
            {players.map((p) => {
              const on = p.id === banker;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`banker-option ${on ? 'on' : ''}`}
                    onClick={() => setBanker(p.id)}
                    aria-pressed={on}
                  >
                    <span className="banker-radio" aria-hidden="true">
                      {on ? '●' : '○'}
                    </span>
                    <span className="banker-option-name">
                      {p.name}
                      {normalizeName(p.name) === normalizeName(currentUser) && (
                        <span className="muted small"> (you)</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="muted small">
            Only the banker can deal from the bank, move other players'
            cards, or resolve the robber. You can hand the role off later.
          </p>
        </div>
      )}

      <p className="muted small">
        Everyone starts with an empty hand. Add the two settlement-adjacent
        resource cards yourself once the game begins.
      </p>

      <div className="form-actions">
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="primary"
          disabled={!canCreate && !draft.trim()}
        >
          Create game
        </button>
      </div>
    </form>
  );
};
