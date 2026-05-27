import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '@/game/leaderboard';
import type { LeaderboardData, TimesByLevel } from '@/game/leaderboard';
import { formatTimeMs } from '@/game/format';
import Panel from '@/components/Panel';

interface LeaderboardProps {
  /** Levels to show time boards for, in display order. */
  levels: number[];
  /** The current player's handle — their rows are highlighted with an arrow. */
  currentUsername?: string;
  /**
   * The player's own best-per-level times this run. Drives both the player's
   * row on the board and (via the API) their rank when outside the top-N.
   */
  timesByLevel?: TimesByLevel;
  /** Also render the overall high-score board above the per-level boards. */
  showOverall?: boolean;
  /** Heading text (defaults to "Fastest Times"). */
  title?: string;
}

type LoadState = 'loading' | 'ready' | 'error';

const EMPTY: LeaderboardData = { boards: {}, overall: [], ranks: {} };

/**
 * Per-level leaderboard ranked by completion time (fastest first), with an
 * optional overall high-score board. The current player is woven into each
 * board: if they made the visible top-N their row is highlighted in place;
 * otherwise their row is appended at the bottom with their true position, so
 * they always see where they stand. Fully self-contained and failure-tolerant:
 * if the API is unavailable it shows a quiet "unavailable" note rather than
 * breaking the surrounding screen.
 */
export default function Leaderboard({
  levels,
  currentUsername,
  timesByLevel,
  showOverall = false,
  title = 'Fastest Times',
}: LeaderboardProps) {
  const [data, setData] = useState<LeaderboardData>(EMPTY);
  const [load, setLoad] = useState<LoadState>('loading');

  // Stable keys so the effect re-runs only when the level set or the player's
  // own times actually change (the latter affects their rank).
  const levelsKey = levels.join(',');
  const timesKey = levels.map((l) => `${l}:${timesByLevel?.[l] ?? ''}`).join(',');

  useEffect(() => {
    let cancelled = false;
    setLoad('loading');
    fetchLeaderboard(levels, { timesByLevel })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        const hasAny =
          Object.keys(result.boards).length > 0 || result.overall.length > 0;
        setLoad(hasAny ? 'ready' : 'error');
      })
      .catch(() => {
        if (!cancelled) setLoad('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelsKey, timesKey]);

  const norm = (currentUsername ?? '').toLowerCase();
  const isMe = (username: string) => norm !== '' && username.toLowerCase() === norm;

  const rowClass = (mine: boolean) =>
    'flex items-baseline justify-between gap-3 px-2 py-0.5 rounded ' +
    (mine ? 'bg-[var(--color-goal)]/15 text-[var(--color-goal)] font-bold' : '');

  /**
   * One board row: an arrow gutter (filled only for the player), the rank, the
   * name, and the right-aligned metric (a time or a score, pre-formatted).
   */
  const renderRow = (
    key: string,
    rank: number | string,
    username: string,
    metric: string,
    mine: boolean,
  ) => (
    <li key={key} className={rowClass(mine)}>
      <span className="flex items-baseline gap-2 min-w-0">
        <span aria-hidden className="w-3 shrink-0 text-center text-[var(--color-goal)]">
          {mine ? '▸' : ''}
        </span>
        <span className="text-[var(--color-text-dim)] w-5 shrink-0 text-right">
          {rank}
        </span>
        <span className="truncate">
          {username}
          {mine && <span className="sr-only"> (you)</span>}
        </span>
      </span>
      <span className="tabular-nums shrink-0">{metric}</span>
    </li>
  );

  return (
    <Panel>
      <h2 className="text-sm font-bold uppercase tracking-widest mb-3 text-center">
        {title}
      </h2>

      {load === 'loading' && (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-2" aria-live="polite">
          Loading…
        </p>
      )}

      {load === 'error' && (
        <p className="text-xs text-[var(--color-text-dim)] text-center py-2">
          Leaderboard unavailable right now.
        </p>
      )}

      {load === 'ready' && (
        <div className="flex flex-col gap-4 max-h-[44vh] overflow-y-auto">
          {showOverall && data.overall.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                Top Scores
              </h3>
              <ol className="font-mono text-sm flex flex-col gap-0.5">
                {data.overall.map((entry, i) =>
                  renderRow(
                    `ov-${entry.username}-${i}`,
                    i + 1,
                    entry.username,
                    entry.score.toLocaleString(),
                    isMe(entry.username),
                  ),
                )}
              </ol>
            </div>
          )}

          {levels.map((level) => {
            const entries = data.boards[level] ?? [];
            const myTime = timesByLevel?.[level];
            const myRank = data.ranks?.[level];
            const meInList = entries.some((e) => isMe(e.username));
            // Append the player's own row only when they didn't make the visible
            // board but we know their time — placed at the bottom with their rank.
            const showMeRow = !meInList && norm !== '' && typeof myTime === 'number';
            return (
              <div key={level}>
                <h3 className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                  Level {level}
                </h3>
                {entries.length === 0 && !showMeRow ? (
                  <p className="text-xs text-[var(--color-text-dim)] py-1">
                    No times yet — be the first.
                  </p>
                ) : (
                  <ol className="font-mono text-sm flex flex-col gap-0.5">
                    {entries.map((entry, i) =>
                      renderRow(
                        `${entry.username}-${i}`,
                        i + 1,
                        entry.username,
                        `${formatTimeMs(entry.timeMs)}s`,
                        isMe(entry.username),
                      ),
                    )}
                    {showMeRow && (
                      <>
                        {entries.length > 0 && (
                          <li
                            aria-hidden
                            className="mx-2 my-1 border-t border-dashed border-[var(--color-text-dim)]/40"
                          />
                        )}
                        {renderRow(
                          `me-${level}`,
                          myRank ?? '–',
                          currentUsername ?? 'you',
                          `${formatTimeMs(myTime as number)}s`,
                          true,
                        )}
                      </>
                    )}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
