import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { fetchLeaderboard } from '@/game/leaderboard';
import type { LeaderboardEntry } from '@/game/leaderboard';
import { formatTimeMs } from '@/game/format';
import Panel from '@/components/Panel';

interface RivalsPanelProps {
  /** the level being played — its fastest-times board is the field of rivals */
  level: number;
  /** live elapsed time (ms); the player's row is placed by this value */
  elapsedMs: number;
  /** current player's handle, so their own past entry can be marked */
  currentUsername?: string;
}

type Row =
  | { kind: 'you'; username: string; timeMs: number }
  | { kind: 'rival'; username: string; timeMs: number; isSelf: boolean };

/**
 * Live standings for the current level. Fetches the level's fastest times once,
 * then inserts a "YOU" row at the position your *live* elapsed time would rank.
 * As the clock ticks up you slide down the board — rivals pop above you and dim
 * (you can no longer beat their time this run); the ones still below you are the
 * targets you're racing. Self-contained and failure-tolerant.
 */
export default function RivalsPanel({ level, elapsedMs, currentUsername }: RivalsPanelProps) {
  const [rivals, setRivals] = useState<LeaderboardEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    fetchLeaderboard([level])
      .then(({ boards }) => {
        if (cancelled) return;
        setRivals(boards[level] ?? []);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setRivals([]);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [level]);

  const norm = (currentUsername ?? '').toLowerCase();

  // Merge the rivals with a live "YOU" row, sorted fastest-first. On a tie, YOU
  // sorts just *after* the rival (you only beat a time by finishing under it).
  const rivalRows: Row[] = rivals.map((r) => ({
    kind: 'rival',
    username: r.username,
    timeMs: r.timeMs,
    isSelf: norm !== '' && r.username.toLowerCase() === norm,
  }));
  const youRow: Row = { kind: 'you', username: 'YOU', timeMs: elapsedMs };
  const combined: Row[] = [...rivalRows, youRow].sort((a, b) => {
    if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
    return a.kind === 'you' ? 1 : -1;
  });

  const youIndex = combined.findIndex((r) => r.kind === 'you');

  return (
    <Panel className="w-56 shrink-0 self-stretch max-h-[70vh] overflow-y-auto">
      <h2 className="font-['Press_Start_2P'] text-[10px] text-[var(--color-accent)] uppercase tracking-widest mb-1 text-center">
        Rivals
      </h2>
      <p className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-widest mb-3 text-center">
        Level {level}
      </p>

      {!loaded ? (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-2">Loading…</p>
      ) : (
        <ol className="font-mono text-xs flex flex-col gap-0.5">
          {combined.map((row, i) => {
            const isYou = row.kind === 'you';
            // Rivals above YOU are already unreachable this run; the first row
            // below YOU is the next target to keep ahead of.
            const beaten = !isYou && i < youIndex;
            const nextTarget = !isYou && i === youIndex + 1;

            return (
              <li
                key={isYou ? '__you' : `${row.username}-${i}`}
                className={clsx(
                  'flex items-baseline justify-between gap-2 px-2 py-0.5 rounded',
                  isYou && 'bg-[var(--color-accent)]/25 text-[var(--color-fg)] font-bold ring-1 ring-[var(--color-accent)]',
                  beaten && 'opacity-40 line-through text-[var(--color-timer-low)]',
                  nextTarget && !isYou && 'text-[var(--color-goal)] font-bold',
                  !isYou && !beaten && !nextTarget && 'text-[var(--color-text-primary)]',
                  row.kind === 'rival' && row.isSelf && !beaten && 'italic',
                )}
              >
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[var(--color-text-dim)] w-4 shrink-0 text-right">{i + 1}</span>
                  <span className="truncate">
                    {isYou ? 'YOU' : row.username}
                    {nextTarget && ' ◂'}
                  </span>
                </span>
                <span className="tabular-nums shrink-0">{formatTimeMs(row.timeMs)}s</span>
              </li>
            );
          })}
        </ol>
      )}

      {loaded && rivals.length === 0 && (
        <p className="text-[10px] text-[var(--color-text-dim)] text-center mt-3 leading-snug">
          No times yet — set the pace!
        </p>
      )}
    </Panel>
  );
}
