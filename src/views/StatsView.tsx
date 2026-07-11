import { useMemo } from 'react';
import {
  Game,
  RESOURCES,
  RESOURCE_LABEL,
  Resource,
  bagTotal,
  normalizeName,
} from '../types';

interface Props {
  games: Game[];
}

interface PlayerRow {
  key: string;
  name: string;
  games: number;
  cardsGained: number;
  cardsSpent: number;
  cardsTraded: number;
  bankerFor: number;
}

const computeRows = (games: Game[]): PlayerRow[] => {
  const byKey = new Map<string, PlayerRow>();
  const ensure = (name: string): PlayerRow => {
    const key = normalizeName(name);
    let row = byKey.get(key);
    if (!row) {
      row = {
        key,
        name,
        games: 0,
        cardsGained: 0,
        cardsSpent: 0,
        cardsTraded: 0,
        bankerFor: 0,
      };
      byKey.set(key, row);
    } else if (row.name !== name) {
      row.name = name;
    }
    return row;
  };

  for (const g of games) {
    for (const p of g.players) {
      const row = ensure(p.name);
      row.games += 1;
      if (p.id === g.banker) row.bankerFor += 1;
    }
    for (const t of g.txns) {
      const total = bagTotal(t.resources);
      // Attribute to the player on either side of a non-bank movement.
      const toPlayer = g.players.find((p) => p.id === t.to);
      const fromPlayer = g.players.find((p) => p.id === t.from);
      if (toPlayer) {
        const row = ensure(toPlayer.name);
        if (t.kind === 'gain' || t.kind === 'adjust') row.cardsGained += total;
        if (t.kind === 'trade' || t.kind === 'steal') row.cardsTraded += total;
      }
      if (fromPlayer) {
        const row = ensure(fromPlayer.name);
        if (t.kind === 'spend' || t.kind === 'discard') row.cardsSpent += total;
        if (t.kind === 'trade' || t.kind === 'steal') row.cardsTraded += total;
      }
    }
  }

  return [...byKey.values()].sort((a, b) => {
    if (b.games !== a.games) return b.games - a.games;
    return b.cardsGained - a.cardsGained;
  });
};

export const StatsView = ({ games }: Props) => {
  const highlights = useMemo(() => {
    let moved = 0;
    let builds = 0;
    let biggestTrade = 0;
    const perResourceMoved: Record<Resource, number> = {
      brick: 0,
      lumber: 0,
      wool: 0,
      grain: 0,
      ore: 0,
    };
    for (const g of games) {
      for (const t of g.txns) {
        const total = bagTotal(t.resources);
        moved += total;
        if (t.kind === 'spend') builds += 1;
        if (t.kind === 'trade' && total > biggestTrade) biggestTrade = total;
        for (const r of RESOURCES) perResourceMoved[r] += t.resources[r] ?? 0;
      }
    }
    let topResource: Resource = 'brick';
    for (const r of RESOURCES) {
      if (perResourceMoved[r] > perResourceMoved[topResource]) topResource = r;
    }
    return {
      gamesCount: games.length,
      endedCount: games.filter((g) => g.endedAt !== null).length,
      moved,
      builds,
      biggestTrade,
      topResource,
      topResourceCount: perResourceMoved[topResource],
    };
  }, [games]);

  const rows = useMemo(() => computeRows(games), [games]);

  if (games.length === 0) {
    return (
      <div className="stats-view">
        <div className="view-head">
          <h1>Stats</h1>
        </div>
        <div className="empty panel">
          <p className="empty-title">No games yet.</p>
          <p className="muted">
            Once you play a few, this page will fill in with cards moved,
            banker records, and per-resource totals.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-view">
      <div className="view-head">
        <h1>Stats</h1>
      </div>

      <ul className="highlight-tiles">
        <li className="highlight-tile panel">
          <span className="highlight-label">Games</span>
          <span className="highlight-value">{highlights.gamesCount}</span>
          <span className="highlight-sub muted small">
            {highlights.endedCount} finished
          </span>
        </li>
        <li className="highlight-tile panel">
          <span className="highlight-label">Cards moved</span>
          <span className="highlight-value">{highlights.moved}</span>
          <span className="highlight-sub muted small">across all games</span>
        </li>
        <li className="highlight-tile panel">
          <span className="highlight-label">Builds</span>
          <span className="highlight-value">{highlights.builds}</span>
          <span className="highlight-sub muted small">
            roads, settlements, cities, dev cards
          </span>
        </li>
        <li className="highlight-tile panel">
          <span className="highlight-label">Most-moved resource</span>
          <span className="highlight-value">
            {RESOURCE_LABEL[highlights.topResource]}
          </span>
          <span className="highlight-sub muted small">
            {highlights.topResourceCount} cards total
          </span>
        </li>
      </ul>

      <h2 className="section-label muted">Player leaderboard</h2>
      <div className="leaderboard panel">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th className="rank">#</th>
              <th>Name</th>
              <th className="num">Games</th>
              <th className="num">Gained</th>
              <th className="num">Spent</th>
              <th className="num">Traded</th>
              <th className="num">Banker</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td className="rank">{i + 1}</td>
                <td className="name">{r.name}</td>
                <td className="num">{r.games}</td>
                <td className="num">{r.cardsGained}</td>
                <td className="num">{r.cardsSpent}</td>
                <td className="num">{r.cardsTraded}</td>
                <td className="num">{r.bankerFor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted small stat-note">
        Gained = cards received from the bank or adjustments. Spent = cards
        returned to the bank via builds or discards. Traded = both directions
        of every trade and every stolen card.
      </p>
    </div>
  );
};
