import clsx from 'clsx';
import type { PlayerState } from '@/game/multiplayer';
import { formatTimeMs } from '@/game/format';
import Panel from '@/components/Panel';

interface OpponentsPanelProps {
  /** live roster from the room snapshot (includes the local player) */
  players: PlayerState[];
  /** the local player's id, so their row can be highlighted */
  playerId: string;
  /** mazes per level — for the "maze x / N" readout */
  mapsPerLevel: number;
  /** the level being raced (shown as a subtitle) */
  level: number;
  /** heading text (defaults to "Opponents") */
  title?: string;
}

/** Standings order: finishers fastest-first, then everyone still racing by progress. */
function rank(players: PlayerState[]): PlayerState[] {
  return [...players].sort((a, b) => {
    const aDone = a.finished && a.finishMs !== null;
    const bDone = b.finished && b.finishMs !== null;
    if (aDone && bDone) return (a.finishMs as number) - (b.finishMs as number);
    if (aDone !== bDone) return aDone ? -1 : 1;
    return b.progress - a.progress;
  });
}

/**
 * Live multiplayer standings — the room twin of `RivalsPanel`. Renders everyone
 * in the room ranked by progress (finishers, fastest first, float to the top),
 * with a progress bar for racers and a locked-in time for finishers. The local
 * player's row is highlighted. Reads straight from the polled snapshot, so it
 * updates roughly once per poll tick; fully self-contained.
 */
export default function OpponentsPanel({
  players,
  playerId,
  mapsPerLevel,
  level,
  title = 'Opponents',
}: OpponentsPanelProps) {
  const ranked = rank(players);

  return (
    <Panel className="w-56 shrink-0 self-stretch max-h-[70vh] overflow-y-auto">
      <h2 className="font-['Press_Start_2P'] text-[10px] text-[var(--color-accent)] uppercase tracking-widest mb-1 text-center">
        {title}
      </h2>
      <p className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-widest mb-3 text-center">
        Level {level}
      </p>

      {ranked.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
          Waiting for racers…
        </p>
      ) : (
        <ol className="font-mono text-xs flex flex-col gap-1.5">
          {ranked.map((p, i) => {
            const isYou = p.playerId === playerId;
            const done = p.finished && p.finishMs !== null;
            const bustedOut = p.finished && p.finishMs === null;
            const pct = Math.round(Math.min(1, Math.max(0, p.progress)) * 100);

            return (
              <li
                key={p.playerId}
                className={clsx(
                  'flex flex-col gap-0.5 px-2 py-1 rounded',
                  isYou &&
                    'bg-[var(--color-accent)]/25 ring-1 ring-[var(--color-accent)]',
                )}
              >
                <span className="flex items-baseline justify-between gap-2 min-w-0">
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span className="text-[var(--color-text-dim)] w-4 shrink-0 text-right">
                      {i + 1}
                    </span>
                    <span
                      className={clsx(
                        'truncate',
                        isYou && 'font-bold text-[var(--color-fg)]',
                        !isYou && 'text-[var(--color-text-primary)]',
                      )}
                    >
                      {isYou ? `${p.username} (you)` : p.username}
                    </span>
                  </span>
                  <span className="tabular-nums shrink-0 text-[var(--color-text-dim)]">
                    {done ? (
                      <span className="text-[var(--color-goal)] font-bold">
                        {formatTimeMs(p.finishMs as number)}s
                      </span>
                    ) : bustedOut ? (
                      <span className="text-[var(--color-timer-low)]">out</span>
                    ) : (
                      `${p.mapIndex + 1}/${mapsPerLevel}`
                    )}
                  </span>
                </span>

                {/* Progress bar for racers still on the course. */}
                {!p.finished && (
                  <div
                    className="relative h-1.5 w-full bg-[var(--color-tile-floor)] border border-[var(--color-tile-border)] overflow-hidden rounded-sm"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${p.username} progress`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-[var(--color-accent)] transition-[width] duration-300 ease-linear"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
