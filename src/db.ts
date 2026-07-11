import PocketBase, { RecordModel } from 'pocketbase';
import {
  Game,
  KnownPlayer,
  Player,
  ResourceBag,
  Txn,
  TxnKind,
  bagFromPartial,
  emptyBag,
  newId,
  normalizeName,
} from './types';

const PB_URL = import.meta.env.VITE_PB_URL || window.location.origin;

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

const tsToMs = (s: string): number => {
  if (!s) return 0;
  const ms = Date.parse(s.replace(' ', 'T').replace(/(\.\d+)?Z?$/, 'Z'));
  return Number.isFinite(ms) ? ms : 0;
};

export const gameFromRecord = (g: RecordModel, txns: Txn[] = []): Game => {
  const players: Player[] = Array.isArray(g.players_json) ? g.players_json : [];
  const rawBanker = typeof g.banker === 'string' ? g.banker : '';
  const banker = rawBanker || (players[0]?.id ?? '');
  return {
    id: g.id,
    name: g.name,
    createdAt: tsToMs(g.created),
    endedAt: g.ended_at ? tsToMs(g.ended_at) : null,
    players,
    banker,
    txns,
  };
};

export const txnFromRecord = (r: RecordModel): Txn => ({
  id: r.id,
  from: String(r.from_party ?? ''),
  to: String(r.to_party ?? ''),
  resources: bagFromPartial(
    typeof r.resources_json === 'object' && r.resources_json !== null
      ? (r.resources_json as Partial<ResourceBag>)
      : {},
  ),
  kind: (r.kind as TxnKind) || 'adjust',
  note: String(r.note ?? ''),
  createdAt: tsToMs(r.created),
});

export const txnGameId = (r: RecordModel): string => String(r.game);

export const playerFromRecord = (r: RecordModel): KnownPlayer => ({
  key: String(r.name_key ?? ''),
  name: String(r.name ?? ''),
  games: 0,
  lastUsed: tsToMs(r.updated ?? r.created ?? ''),
});

export const fetchAll = async (): Promise<{
  games: Game[];
  players: KnownPlayer[];
}> => {
  const [gameRecs, txnRecs, playerRecs] = await Promise.all([
    pb.collection('games').getFullList({ sort: '-created' }),
    pb.collection('transactions').getFullList({ sort: 'created' }),
    pb.collection('players').getFullList().catch(() => [] as RecordModel[]),
  ]);

  const txnsByGame = new Map<string, Txn[]>();
  for (const r of txnRecs) {
    const gameId = String(r.game);
    if (!txnsByGame.has(gameId)) txnsByGame.set(gameId, []);
    txnsByGame.get(gameId)!.push(txnFromRecord(r));
  }

  const games = gameRecs.map((g) =>
    gameFromRecord(g, txnsByGame.get(g.id) ?? []),
  );

  const players = playerRecs
    .map(playerFromRecord)
    .filter((p) => p.key.length > 0);

  return { games, players };
};

export const registerPlayerNames = async (players: Player[]): Promise<void> => {
  await Promise.all(
    players.map(async (p) => {
      const key = normalizeName(p.name);
      const name = p.name.trim();
      if (!key || !name) return;
      try {
        await pb.collection('players').create({ name, name_key: key });
      } catch {
        // Already exists or write denied — either way we don't retry.
      }
    }),
  );
};

export const createGame = async (
  name: string,
  players: Player[],
  banker: string,
): Promise<Game> => {
  const rec = await pb.collection('games').create({
    name,
    players_json: players,
    banker,
    ended_at: null,
  });
  registerPlayerNames(players).catch(() => {});
  return gameFromRecord(rec, []);
};

export const updateGameBanker = async (
  id: string,
  banker: string,
): Promise<void> => {
  await pb.collection('games').update(id, { banker });
};

export const updateGameEnded = async (
  id: string,
  endedAt: number | null,
): Promise<void> => {
  await pb.collection('games').update(id, {
    ended_at: endedAt === null ? null : new Date(endedAt).toISOString(),
  });
};

export const deleteGame = async (id: string): Promise<void> => {
  await pb.collection('games').delete(id);
};

export const updateGamePlayers = async (
  id: string,
  players: Player[],
): Promise<void> => {
  await pb.collection('games').update(id, { players_json: players });
  registerPlayerNames(players).catch(() => {});
};

export const createTxn = async (
  gameId: string,
  txn: {
    from: string;
    to: string;
    resources: ResourceBag;
    kind: TxnKind;
    note: string;
  },
): Promise<Txn> => {
  const rec = await pb.collection('transactions').create({
    game: gameId,
    from_party: txn.from,
    to_party: txn.to,
    resources_json: txn.resources,
    kind: txn.kind,
    note: txn.note,
  });
  return txnFromRecord(rec);
};

export const deleteTxn = async (txnId: string): Promise<void> => {
  await pb.collection('transactions').delete(txnId);
};

// Convenience re-export so callers don't need to reach into types.
export const generateLocalPlayerId = newId;
export { emptyBag };
