import clsx from 'clsx';
import { formatTimeMs } from '@/game/format';

interface HudProps {
  /** current level (1-based) */
  level: number;
  /** which maze within the level (0-based) */
  mapIndex: number;
  /** mazes per level — for the "maze x / N" readout */
  mapsPerLevel: number;
  /** elapsed time this level (ms), counting up */
  elapsedMs: number;
  /** time limit this level (ms) */
  limitMs: number;
  /** accumulated run score */
  score: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function padScore(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(6, '0');
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

/** Depleting bar of time left before the level's limit. */
function LimitBar({ elapsedMs, limitMs }: { elapsedMs: number; limitMs: number }) {
  const remaining = Math.max(0, limitMs - elapsedMs);
  const ratio = limitMs > 0 ? Math.min(1, remaining / limitMs) : 0;
  const pct = (ratio * 100).toFixed(1) + '%';

  const isLow = ratio <= 0.25;
  const isWarn = ratio <= 0.5;
  const barColor = isLow
    ? 'var(--color-timer-low)'
    : isWarn
    ? 'var(--color-timer-warn)'
    : 'var(--color-timer-ok)';

  return (
    <div
      role="progressbar"
      aria-label="Time left before limit"
      aria-valuenow={Math.round(remaining / 1000)}
      aria-valuemin={0}
      aria-valuemax={Math.round(limitMs / 1000)}
      className="relative w-full h-3 bg-[var(--color-tile-floor)] border-2 border-[var(--color-tile-border)] overflow-hidden"
    >
      <div
        className={clsx(
          'absolute inset-y-0 left-0 transition-[width] duration-[120ms] ease-linear',
          isLow && 'animate-timer-low',
        )}
        style={{ width: pct, backgroundColor: barColor }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HUD                                                                  */
/* ------------------------------------------------------------------ */

/**
 * Game heads-up display. Shows the run score, the current level + maze
 * progress, the elapsed (count-up) clock, and a bar depleting toward the
 * level's time limit.
 */
export default function Hud({
  level,
  mapIndex,
  mapsPerLevel,
  elapsedMs,
  limitMs,
  score,
}: HudProps) {
  const remaining = Math.max(0, limitMs - elapsedMs);
  const isLow = limitMs > 0 && remaining / limitMs <= 0.25;

  return (
    <header
      className="w-full bg-[var(--color-arcade-panel)] border-b-4 border-[var(--color-accent)] px-4 py-3"
      aria-label="Game status"
    >
      {/* Top row: SCORE | LEVEL | MAZE x/N */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex flex-col gap-1">
          <span className="font-['Press_Start_2P'] text-[8px] text-[var(--color-text-muted)] uppercase tracking-widest">
            Score
          </span>
          <span className="font-['Press_Start_2P'] text-base text-[var(--color-fg)] tabular-nums">
            {padScore(score)}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="font-['Press_Start_2P'] text-[8px] text-[var(--color-text-muted)] uppercase tracking-widest">
            Level
          </span>
          <span className="font-['Press_Start_2P'] text-base text-[var(--color-accent)] tabular-nums">
            {String(level).padStart(2, '0')}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="font-['Press_Start_2P'] text-[8px] text-[var(--color-text-muted)] uppercase tracking-widest">
            Maze
          </span>
          <span className="font-['Press_Start_2P'] text-base text-[var(--color-fg)] tabular-nums">
            {mapIndex + 1}/{mapsPerLevel}
          </span>
        </div>
      </div>

      {/* Timer row: count-up elapsed clock + depleting limit bar */}
      <div className="flex items-center gap-3">
        <span
          className={clsx(
            'font-["Press_Start_2P"] text-xs tabular-nums shrink-0',
            isLow
              ? 'text-[var(--color-timer-low)] animate-timer-low'
              : 'text-[var(--color-timer-ok)]',
          )}
          aria-live="off"
        >
          {formatTimeMs(elapsedMs)}s
        </span>

        <LimitBar elapsedMs={elapsedMs} limitMs={limitMs} />
      </div>
    </header>
  );
}
