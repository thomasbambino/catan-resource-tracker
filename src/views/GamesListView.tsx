import { Game, handSize, normalizeName } from '../types';
import { useConfirm } from '../ConfirmDialog';

interface Props {
  games: Game[];
  currentUser: string;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const relativeTime = (ts: number): string => {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
};

export const GamesListView = ({
  games,
  currentUser,
  onNew,
  onOpen,
  onDelete,
}: Props) => {
  const confirm = useConfirm();
  const myKey = normalizeName(currentUser);

  const active = games.filter((g) => g.endedAt === null);
  const ended = games.filter((g) => g.endedAt !== null);

  const handleDelete = async (game: Game) => {
    const ok = await confirm({
      title: 'Delete this game?',
      body: (
        <p className="muted">
          <strong>{game.name}</strong> and its entire move log will be
          permanently removed. This can't be undone.
        </p>
      ),
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) onDelete(game.id);
  };

  const renderCard = (game: Game) => {
    const me = game.players.find((p) => normalizeName(p.name) === myKey);
    const myTotal = me ? handSize(game, me.id) : null;
    return (
      <li key={game.id} className="game-card panel">
        <button className="game-card-main" onClick={() => onOpen(game.id)}>
          <div className="game-card-head">
            <span className="game-card-name">{game.name}</span>
            {game.endedAt !== null && <span className="badge">Ended</span>}
          </div>
          <div className="game-card-meta muted small">
            {game.players.length} player{game.players.length === 1 ? '' : 's'}
            {' · '}
            {game.endedAt !== null
              ? `ended ${relativeTime(game.endedAt)}`
              : relativeTime(game.createdAt)}
          </div>
          {myTotal !== null && (
            <div className="game-card-balance">
              {myTotal} cards
              <span className="muted small"> · you</span>
            </div>
          )}
        </button>
        <button
          className="icon-btn danger"
          aria-label="Delete game"
          onClick={() => handleDelete(game)}
        >
          ×
        </button>
      </li>
    );
  };

  return (
    <div className="games-view">
      <div className="view-head">
        <h1>Games</h1>
        <button className="primary" onClick={onNew}>
          + New game
        </button>
      </div>

      {games.length === 0 ? (
        <div className="empty panel">
          <p className="empty-title">No games yet</p>
          <p className="muted">
            Start a game, add the players around the table, and track every
            hand from the app.
          </p>
          <button className="primary" onClick={onNew}>
            Start a game
          </button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <ul className="game-list">{active.map(renderCard)}</ul>
          )}
          {ended.length > 0 && (
            <>
              <h2 className="section-label muted">Ended</h2>
              <ul className="game-list">{ended.map(renderCard)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
};
