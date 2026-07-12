import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BANK,
  Game,
  KnownPlayer,
  Player,
  ResourceBag,
  Txn,
  TxnKind,
  deriveKnownPlayers,
  newId,
  normalizeName,
} from './types';
import {
  createGame as dbCreateGame,
  createTxn as dbCreateTxn,
  deleteGame as dbDeleteGame,
  deleteTxn as dbDeleteTxn,
  fetchAll,
  gameFromRecord,
  txnFromRecord,
  txnGameId,
  updateGameBanker as dbUpdateGameBanker,
  updateGameEnded as dbUpdateGameEnded,
  updateGamePlayers as dbUpdateGamePlayers,
  updateGameRolled7 as dbUpdateGameRolled7,
} from './db';
import { connectWsRealtime, WsStatus } from './realtime';
import { filterVisibleGames } from './visibility';
import { useUser } from './user';
import { LoginModal, UserPill } from './Login';
import { GameSwitcher } from './GameSwitcher';
import { GamesListView } from './views/GamesListView';
import { NewGameView } from './views/NewGameView';
import { GameView } from './views/GameView';
import { StatsView } from './views/StatsView';

type Route =
  | { name: 'list' }
  | { name: 'new' }
  | { name: 'game'; id: string }
  | { name: 'analytics' };

const parseHash = (): Route => {
  const h = window.location.hash.replace(/^#/, '');
  if (h === '/new') return { name: 'new' };
  if (h === '/analytics') return { name: 'analytics' };
  const g = h.match(/^\/game\/([^/]+)$/);
  if (g) return { name: 'game', id: g[1] };
  return { name: 'list' };
};

export const navigate = (path: string) => {
  window.location.hash = path;
};

const routeKey = (r: Route): string => {
  switch (r.name) {
    case 'game': return `game:${r.id}`;
    default: return r.name;
  }
};

export const App = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [allPlayers, setAllPlayers] = useState<KnownPlayer[]>([]);
  const knownPlayers = useMemo(() => deriveKnownPlayers(games), [games]);
  const [route, setRoute] = useState<Route>(() => parseHash());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rtStatus, setRtStatus] = useState<WsStatus>('connecting');
  const [user, setUser] = useUser();
  const [loginOpen, setLoginOpen] = useState(false);

  const myKey = user ? normalizeName(user) : null;
  const visibleGames = useMemo(
    () => filterVisibleGames(games, myKey),
    [games, myKey],
  );

  const showError = useCallback((e: unknown) => {
    const msg =
      e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unknown error';
    setToast(msg);
    window.clearTimeout((showError as { _t?: number })._t);
    (showError as { _t?: number })._t = window.setTimeout(() => setToast(null), 4500);
  }, []);

  const reload = useCallback(async () => {
    const { games: gs, players: ps } = await fetchAll();
    setGames(gs);
    setAllPlayers(ps);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await reload();
        if (alive) setLoadError(null);
      } catch (e) {
        if (alive) {
          setLoadError(
            e instanceof Error ? e.message : 'Could not reach the database.',
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Safety nets for state drift when realtime misses an event: refetch when
  // the WS reconnects after being dropped, and when the tab becomes visible
  // again (iOS Safari can silently stall a WS while backgrounded).
  const prevRtStatus = useRef<WsStatus | null>(null);
  useEffect(() => {
    if (prevRtStatus.current === 'disconnected' && rtStatus === 'connected') {
      reload().catch(() => {});
    }
    prevRtStatus.current = rtStatus;
  }, [rtStatus, reload]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        reload().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reload]);

  // Realtime: live-sync changes across phones via the WS bridge sidecar
  // (PocketBase's native SSE doesn't survive Railway's proxy). Handlers are
  // idempotent so an echo of the local client's own write is a no-op.
  useEffect(() => {
    if (loading || loadError) return;
    const disconnect = connectWsRealtime({
      onStatus: setRtStatus,
      onGame: (action, record) => {
        if (action === 'delete') {
          setGames((cur) => cur.filter((g) => g.id !== record.id));
          return;
        }
        setGames((cur) => {
          const idx = cur.findIndex((g) => g.id === record.id);
          if (idx === -1) {
            return [gameFromRecord(record), ...cur];
          }
          const existing = cur[idx];
          const merged = gameFromRecord(record, existing.txns);
          if (
            merged.name === existing.name &&
            merged.endedAt === existing.endedAt &&
            merged.banker === existing.banker &&
            merged.rolled7At === existing.rolled7At &&
            JSON.stringify(merged.players) === JSON.stringify(existing.players)
          ) {
            return cur;
          }
          const next = cur.slice();
          next[idx] = merged;
          return next;
        });
      },
      onTxn: (action, record) => {
        const gameId = txnGameId(record);
        if (action === 'delete') {
          setGames((cur) =>
            cur.map((g) =>
              g.id === gameId
                ? { ...g, txns: g.txns.filter((t) => t.id !== record.id) }
                : g,
            ),
          );
          return;
        }
        const txn = txnFromRecord(record);
        setGames((cur) =>
          cur.map((g) => {
            if (g.id !== gameId) return g;
            const idx = g.txns.findIndex((t) => t.id === txn.id);
            if (idx !== -1) {
              const next = g.txns.slice();
              next[idx] = txn;
              return { ...g, txns: next };
            }
            // Claim our own optimistic temp- entry if one matches, so we
            // don't double-count when the WS echo races the DB response.
            const tempIdx = g.txns.findIndex(
              (t) =>
                t.id.startsWith('temp-') &&
                t.from === txn.from &&
                t.to === txn.to &&
                JSON.stringify(t.resources) === JSON.stringify(txn.resources),
            );
            if (tempIdx !== -1) {
              const next = g.txns.slice();
              next[tempIdx] = txn;
              return { ...g, txns: next };
            }
            return { ...g, txns: [...g.txns, txn] };
          }),
        );
      },
      onPlayer: (action, record) => {
        if (action === 'delete') {
          setAllPlayers((cur) => cur.filter((p) => p.key !== String(record.name_key ?? '')));
          return;
        }
        const p: KnownPlayer = {
          key: String(record.name_key ?? ''),
          name: String(record.name ?? ''),
          games: 0,
          lastUsed: 0,
        };
        if (!p.key) return;
        setAllPlayers((cur) => {
          const idx = cur.findIndex((x) => x.key === p.key);
          if (idx === -1) return [...cur, p];
          const existing = cur[idx];
          if (existing.name === p.name) return cur;
          const next = cur.slice();
          next[idx] = { ...existing, name: p.name };
          return next;
        });
      },
    });
    return disconnect;
  }, [loading, loadError]);

  const createGame = useCallback(
    async (name: string, players: Player[], banker: string) => {
      try {
        const created = await dbCreateGame(
          name.trim() || 'Untitled game',
          players,
          banker,
        );
        setGames((prev) => [created, ...prev]);
        navigate(`/game/${created.id}`);
      } catch (e) {
        showError(e);
      }
    },
    [showError],
  );

  const deleteGame = useCallback(
    async (id: string) => {
      const prev = games;
      setGames((cur) => cur.filter((g) => g.id !== id));
      try {
        await dbDeleteGame(id);
      } catch (e) {
        setGames(prev);
        showError(e);
      }
    },
    [games, showError],
  );

  const addTxn = useCallback(
    async (
      gameId: string,
      txn: {
        from: string;
        to: string;
        resources: ResourceBag;
        kind: TxnKind;
        note: string;
      },
    ) => {
      const optimisticId = `temp-${newId()}`;
      const optimistic: Txn = {
        id: optimisticId,
        from: txn.from,
        to: txn.to,
        resources: txn.resources,
        kind: txn.kind,
        note: txn.note,
        createdAt: Date.now(),
      };
      setGames((cur) =>
        cur.map((g) =>
          g.id === gameId ? { ...g, txns: [...g.txns, optimistic] } : g,
        ),
      );
      try {
        const created = await dbCreateTxn(gameId, txn);
        setGames((cur) =>
          cur.map((g) =>
            g.id === gameId
              ? {
                  ...g,
                  txns: [
                    ...g.txns.filter(
                      (t) => t.id !== optimisticId && t.id !== created.id,
                    ),
                    created,
                  ],
                }
              : g,
          ),
        );
      } catch (e) {
        setGames((cur) =>
          cur.map((g) =>
            g.id === gameId
              ? { ...g, txns: g.txns.filter((t) => t.id !== optimisticId) }
              : g,
          ),
        );
        showError(e);
      }
    },
    [showError],
  );

  const removeTxn = useCallback(
    async (gameId: string, txnId: string) => {
      const prev = games;
      setGames((cur) =>
        cur.map((g) =>
          g.id === gameId ? { ...g, txns: g.txns.filter((t) => t.id !== txnId) } : g,
        ),
      );
      if (txnId.startsWith('temp-')) return;
      try {
        await dbDeleteTxn(txnId);
      } catch (e) {
        setGames(prev);
        showError(e);
      }
    },
    [games, showError],
  );

  const updatePlayers = useCallback(
    async (gameId: string, players: Player[]) => {
      const prev = games;
      setGames((cur) =>
        cur.map((g) => (g.id === gameId ? { ...g, players } : g)),
      );
      try {
        await dbUpdateGamePlayers(gameId, players);
      } catch (e) {
        setGames(prev);
        showError(e);
      }
    },
    [games, showError],
  );

  const transferBanker = useCallback(
    async (gameId: string, banker: string) => {
      const prev = games;
      setGames((cur) =>
        cur.map((g) => (g.id === gameId ? { ...g, banker } : g)),
      );
      try {
        await dbUpdateGameBanker(gameId, banker);
      } catch (e) {
        setGames(prev);
        showError(e);
      }
    },
    [games, showError],
  );

  const setRolled7 = useCallback(
    async (gameId: string, rolled7At: number | null) => {
      setGames((cur) =>
        cur.map((g) => (g.id === gameId ? { ...g, rolled7At } : g)),
      );
      try {
        await dbUpdateGameRolled7(gameId, rolled7At);
      } catch (e) {
        showError(e);
      }
    },
    [showError],
  );

  const endGame = useCallback(
    async (gameId: string) => {
      const ts = Date.now();
      setGames((cur) =>
        cur.map((g) => (g.id === gameId ? { ...g, endedAt: ts } : g)),
      );
      try {
        await dbUpdateGameEnded(gameId, ts);
      } catch (e) {
        showError(e);
      }
    },
    [showError],
  );

  const reopenGame = useCallback(
    async (gameId: string) => {
      setGames((cur) =>
        cur.map((g) => (g.id === gameId ? { ...g, endedAt: null } : g)),
      );
      try {
        await dbUpdateGameEnded(gameId, null);
      } catch (e) {
        showError(e);
      }
    },
    [showError],
  );

  let body: JSX.Element;
  if (loading) {
    body = (
      <div className="empty panel">
        <p className="muted">Loading…</p>
      </div>
    );
  } else if (loadError) {
    body = (
      <div className="empty panel">
        <p className="empty-title">Couldn't reach the database</p>
        <p className="muted">{loadError}</p>
        <button
          className="primary"
          onClick={async () => {
            setLoading(true);
            try {
              await reload();
              setLoadError(null);
            } catch (e) {
              setLoadError(
                e instanceof Error ? e.message : 'Could not reach the database.',
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          Retry
        </button>
      </div>
    );
  } else if (!user) {
    body = (
      <div className="empty panel">
        <p className="empty-title">Sign in to see your games</p>
        <p className="muted">
          Type the name you play under — you'll see the games and balances for
          yourself and the people you've played with.
        </p>
        <button className="primary" onClick={() => setLoginOpen(true)}>
          Sign in
        </button>
      </div>
    );
  } else if (route.name === 'new') {
    body = (
      <NewGameView
        knownPlayers={knownPlayers}
        allPlayers={allPlayers}
        currentUser={user}
        onCreate={createGame}
        onCancel={() => navigate('/')}
      />
    );
  } else if (route.name === 'analytics') {
    body = <StatsView games={visibleGames} />;
  } else if (route.name === 'game') {
    const game = visibleGames.find((g) => g.id === route.id);
    if (!game) {
      const existsButHidden = games.some((g) => g.id === route.id);
      body = (
        <div className="empty panel">
          <p className="empty-title">
            {existsButHidden ? 'Game not visible' : "That game doesn't exist anymore."}
          </p>
          {existsButHidden && (
            <p className="muted">
              You can only open games involving you or people you've played with.
            </p>
          )}
          <button className="primary" onClick={() => navigate('/')}>
            Back to games
          </button>
        </div>
      );
    } else {
      body = (
        <GameView
          game={game}
          currentUser={user}
          onAddTxn={(t) => addTxn(game.id, t)}
          onRemoveTxn={(tid) => removeTxn(game.id, tid)}
          onUpdatePlayers={(players) => updatePlayers(game.id, players)}
          onTransferBanker={(banker) => transferBanker(game.id, banker)}
          onRoll7={() => setRolled7(game.id, Date.now())}
          onClearRoll7={() => setRolled7(game.id, null)}
          onEndGame={() => endGame(game.id)}
          onReopenGame={() => reopenGame(game.id)}
          onDeleteGame={async () => {
            await deleteGame(game.id);
            navigate('/');
          }}
        />
      );
    }
  } else {
    body = (
      <GamesListView
        games={visibleGames}
        currentUser={user}
        onNew={() => navigate('/new')}
        onOpen={(id) => navigate(`/game/${id}`)}
        onDelete={deleteGame}
      />
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <GameSwitcher current="catan" />
        <nav className="top-nav">
          <button
            className={`nav-link ${route.name === 'list' ? 'on' : ''}`}
            onClick={() => navigate('/')}
          >
            Games
          </button>
          <button
            className={`nav-link ${route.name === 'analytics' ? 'on' : ''}`}
            onClick={() => navigate('/analytics')}
          >
            Stats
          </button>
          <UserPill user={user} onClick={() => setLoginOpen(true)} />
        </nav>
      </header>
      <LoginModal
        open={loginOpen}
        user={user}
        onClose={() => setLoginOpen(false)}
        onSignIn={(name) => {
          setUser(name);
          setLoginOpen(false);
        }}
        onSignOut={() => {
          setUser(null);
          setLoginOpen(false);
          navigate('/');
        }}
      />
      <main>
        <div className="route-view" key={routeKey(route)}>
          {body}
        </div>
      </main>
      <div
        className={`live-pill live-${rtStatus}`}
        title={
          rtStatus === 'connected'
            ? 'Live sync is on'
            : rtStatus === 'connecting'
            ? 'Connecting to live sync…'
            : 'Live sync offline'
        }
        aria-live="polite"
      >
        <span className="live-dot" aria-hidden="true" />
        <span className="live-label">
          {rtStatus === 'connected' ? 'Live' : rtStatus === 'connecting' ? '…' : 'Offline'}
        </span>
      </div>
      {toast && (
        <div className="toast">
          {toast}
          <button className="toast-close" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
};

// Re-exported so views can reference the bank sentinel without importing types.
export { BANK };
