// The bank is a virtual party with unlimited resources. Transactions use
// this sentinel in their `from`/`to` fields to mean "the bank" instead of
// a player id.
export const BANK = 'bank';

// The five Catan resources. Order matters for display consistency across
// the app.
export const RESOURCES = ['brick', 'lumber', 'wool', 'grain', 'ore'] as const;
export type Resource = (typeof RESOURCES)[number];

export type ResourceBag = Record<Resource, number>;

export const emptyBag = (): ResourceBag => ({
  brick: 0,
  lumber: 0,
  wool: 0,
  grain: 0,
  ore: 0,
});

export const bagFromPartial = (p: Partial<ResourceBag>): ResourceBag => ({
  brick: p.brick ?? 0,
  lumber: p.lumber ?? 0,
  wool: p.wool ?? 0,
  grain: p.grain ?? 0,
  ore: p.ore ?? 0,
});

export const bagTotal = (bag: ResourceBag): number =>
  RESOURCES.reduce((sum, r) => sum + (bag[r] ?? 0), 0);

export const bagIsEmpty = (bag: ResourceBag): boolean => bagTotal(bag) === 0;

export const addBags = (a: ResourceBag, b: ResourceBag): ResourceBag => {
  const out = emptyBag();
  for (const r of RESOURCES) out[r] = (a[r] ?? 0) + (b[r] ?? 0);
  return out;
};

export const subBags = (a: ResourceBag, b: ResourceBag): ResourceBag => {
  const out = emptyBag();
  for (const r of RESOURCES) out[r] = (a[r] ?? 0) - (b[r] ?? 0);
  return out;
};

// Standard Catan build costs.
export const COST_ROAD: ResourceBag = bagFromPartial({ brick: 1, lumber: 1 });
export const COST_SETTLEMENT: ResourceBag = bagFromPartial({
  brick: 1,
  lumber: 1,
  wool: 1,
  grain: 1,
});
export const COST_CITY: ResourceBag = bagFromPartial({ grain: 2, ore: 3 });
export const COST_DEV_CARD: ResourceBag = bagFromPartial({
  wool: 1,
  grain: 1,
  ore: 1,
});

export const RESOURCE_LABEL: Record<Resource, string> = {
  brick: 'Brick',
  lumber: 'Lumber',
  wool: 'Wool',
  grain: 'Grain',
  ore: 'Ore',
};

// Short glyphs for tight spots. The full-color icons live in icons.tsx.
export const RESOURCE_SHORT: Record<Resource, string> = {
  brick: 'B',
  lumber: 'L',
  wool: 'W',
  grain: 'G',
  ore: 'O',
};

export interface Player {
  id: string;
  name: string;
}

// A resource "transaction" is any movement of resource cards between two
// parties. The whole game state is derived from this log — hand totals,
// what got spent, what got traded — so the log can never drift out of
// sync with what people actually did.
export type TxnKind =
  | 'gain'    // bank -> player (dice roll payout, initial hand, etc.)
  | 'spend'   // player -> bank (build road/settlement/city, buy dev card)
  | 'trade'   // player -> player (one direction of a trade)
  | 'discard' // player -> bank (rolled a 7 with 8+ cards)
  | 'steal'   // player -> player (robber)
  | 'adjust'; // manual correction

export interface Txn {
  id: string;
  from: string;           // player id or BANK
  to: string;             // player id or BANK
  resources: ResourceBag; // what moved (positive counts only)
  kind: TxnKind;
  note: string;
  createdAt: number;
}

export interface Game {
  id: string;
  name: string;
  createdAt: number;
  endedAt: number | null;
  players: Player[];
  // Player id of the current banker. Only the banker can move other
  // players' resources, deal from the bank, or resolve the robber.
  banker: string;
  // Timestamp (ms) of the most recent 7 roll. Clients watch this field
  // and auto-open the discard picker when it changes and their hand is
  // over 7. Null when no pending 7.
  rolled7At: number | null;
  txns: Txn[];
}

export interface KnownPlayer {
  key: string;
  name: string;
  games: number;
  lastUsed: number;
}

export const newId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const normalizeName = (n: string) => n.trim().toLowerCase();

export const isBank = (party: string) => party === BANK;

// A player's current hand — sum of everything they've received minus
// everything they've spent, traded, discarded, or been robbed of.
export const handOf = (game: Game, playerId: string): ResourceBag => {
  const hand = emptyBag();
  for (const t of game.txns) {
    if (t.to === playerId) {
      for (const r of RESOURCES) hand[r] += t.resources[r] ?? 0;
    }
    if (t.from === playerId) {
      for (const r of RESOURCES) hand[r] -= t.resources[r] ?? 0;
    }
  }
  return hand;
};

export const handSize = (game: Game, playerId: string): number =>
  bagTotal(handOf(game, playerId));

// Net resources the bank has paid out (positive) or taken in (negative).
export const bankNet = (game: Game): ResourceBag => {
  const net = emptyBag();
  for (const t of game.txns) {
    if (t.from === BANK) {
      for (const r of RESOURCES) net[r] += t.resources[r] ?? 0;
    }
    if (t.to === BANK) {
      for (const r of RESOURCES) net[r] -= t.resources[r] ?? 0;
    }
  }
  return net;
};

export const partyName = (game: Game, party: string): string => {
  if (isBank(party)) return 'Bank';
  return game.players.find((p) => p.id === party)?.name ?? 'Unknown';
};

export const bankerOf = (game: Game): Player | null => {
  const byId = game.players.find((p) => p.id === game.banker);
  if (byId) return byId;
  return game.players[0] ?? null;
};

export const isBankerUser = (game: Game, currentUser: string): boolean => {
  const banker = bankerOf(game);
  if (!banker) return false;
  return normalizeName(banker.name) === normalizeName(currentUser);
};

// Whether a player's hand can cover a proposed cost.
export const canAfford = (
  game: Game,
  playerId: string,
  cost: ResourceBag,
): boolean => {
  const hand = handOf(game, playerId);
  return RESOURCES.every((r) => hand[r] >= (cost[r] ?? 0));
};

export const deriveKnownPlayers = (games: Game[]): KnownPlayer[] => {
  const byKey = new Map<string, KnownPlayer>();
  for (const g of games) {
    const seenInGame = new Set<string>();
    for (const p of g.players) {
      const key = normalizeName(p.name);
      if (!key || seenInGame.has(key)) continue;
      seenInGame.add(key);
      const cur = byKey.get(key);
      if (!cur) {
        byKey.set(key, { key, name: p.name, games: 1, lastUsed: g.createdAt });
      } else {
        cur.games += 1;
        if (g.createdAt >= cur.lastUsed) {
          cur.lastUsed = g.createdAt;
          cur.name = p.name;
        }
      }
    }
  }
  return [...byKey.values()].sort((a, b) =>
    b.games !== a.games ? b.games - a.games : b.lastUsed - a.lastUsed,
  );
};

// Compact "1B 2W 3G" summary of a bag — for logs and previews.
export const formatBag = (bag: ResourceBag): string => {
  const parts: string[] = [];
  for (const r of RESOURCES) {
    const n = bag[r] ?? 0;
    if (n > 0) parts.push(`${n}${RESOURCE_SHORT[r]}`);
  }
  return parts.length === 0 ? '—' : parts.join(' ');
};
