import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '@/game/leaderboard';
import type { Boards, ScoresByLevel } from '@/game/leaderboard';
import Panel from '@/components/Panel';

interface LeaderboardProps {
  /** Levels to show boards for, in display order. */
  levels: number[];
  /** The current player's handle — their rows are highlighted. */
  currentUsername?: string;
  /** The player's own best-per-level scores this run, for "new entry" framing. */
  scoresByLevel?: ScoresByLevel;
}

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Per-level leaderboard. Fetches the top entries for each requested level and
 * renders one ranked board per level. Fully self-contained and failure-tolerant:
 * if the API is unavailable it shows a quiet "unavailable" note rather than
 * breaking the surrounding screen.
 */
export default function Leaderboard({
  levels,
  currentUsername,
  scoresByLevel,
}: LeaderboardProps) {
  const [boards, setBoards] = useState<Boards>({});
  const [load, setLoad] = useState<LoadState>('loading');

  // Stable key so the effect re-runs only when the actual level set changes.
  const levelsKey = levels.join(',');

  useEffect(() => {
    let cancelled = false;
    setLoad('loading');
    fetchLeaderboard(levels)
      .then((result) => {
        if (cancelled) return;
        setBoards(result);
        setLoad(Object.keys(result).length > 0 ? 'ready' : 'error');
      })
      .catch(() => {
        if (!cancelled) setLoad('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelsKey]);

  const norm = (currentUsername ?? '').toLowerCase();

  return (
    <Panel>
      <h2 className="text-sm font-bold uppercase tracking-widest mb-3 text-center">
        Leaderboard
      </h2>

      {load === 'loading' && (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-2" aria-live="polite">
          Loading scores…
        </p>
      )}

      {load === 'error' && (
        <p className="text-xs text-[var(--color-text-dim)] text-center py-2">
          Leaderboard unavailable right now.
        </p>
      )}

      {load === 'ready' && (
        <div className="flex flex-col gap-4 max-h-[40vh] overflow-y-auto">
          {levels.map((level) => {
            const entries = boards[level] ?? [];
            const myScore = scoresByLevel?.[level];
            return (
              <div key={level}>
                <h3 className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-1 flex items-center justify-between gap-2">
                  <span>Level {level}</span>
                  {typeof myScore === 'number' && (
                    <span className="text-[var(--color-text-dim)]">
                      you: {myScore.toLocaleString()}
                    </span>
                  )}
                </h3>
                {entries.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-dim)] py-1">
                    No scores yet — be the first.
                  </p>
                ) : (
                  <ol className="font-mono text-sm flex flex-col gap-0.5">
                    {entries.map((entry, i) => {
                      const isMe = entry.username.toLowerCase() === norm && norm !== '';
                      return (
                        <li
                          key={`${entry.username}-${i}`}
                          className={
                            'flex items-baseline justify-between gap-3 px-2 py-0.5 rounded ' +
                            (isMe
                              ? 'bg-[var(--color-goal)]/15 text-[var(--color-goal)] font-bold'
                              : '')
                          }
                        >
                          <span className="flex items-baseline gap-2 min-w-0">
                            <span className="text-[var(--color-text-dim)] w-5 shrink-0 text-right">
                              {i + 1}
                            </span>
                            <span className="truncate">{entry.username}</span>
                          </span>
                          <span className="tabular-nums shrink-0">
                            {entry.score.toLocaleString()}
                          </span>
                        </li>
                      );
                    })}
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
