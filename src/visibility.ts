import { Game, normalizeName } from './types';

const gameHas = (g: Game, key: string): boolean =>
  g.players.some((p) => normalizeName(p.name) === key);

// People the user has shared a game with. One-hop only — we deliberately do
// NOT include playmates-of-playmates.
export const playmateKeys = (games: Game[], myKey: string | null): Set<string> => {
  const set = new Set<string>();
  if (!myKey) return set;
  for (const g of games) {
    if (!gameHas(g, myKey)) continue;
    for (const p of g.players) {
      const k = normalizeName(p.name);
      if (k && k !== myKey) set.add(k);
    }
  }
  return set;
};

// A game is visible to the user iff every player in it is the user or one of
// their direct playmates. This keeps the "I see games involving people I
// know" feel without leaking transitively to strangers.
export const isGameVisible = (
  g: Game,
  myKey: string | null,
  playmates: Set<string>,
): boolean => {
  if (!myKey) return false;
  for (const p of g.players) {
    const k = normalizeName(p.name);
    if (k !== myKey && !playmates.has(k)) return false;
  }
  return true;
};

export const filterVisibleGames = (
  games: Game[],
  myKey: string | null,
): Game[] => {
  if (!myKey) return [];
  const playmates = playmateKeys(games, myKey);
  return games.filter((g) => isGameVisible(g, myKey, playmates));
};
