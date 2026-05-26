import clsx from 'clsx';
import { type MapResult, type Medal } from '@/game/types';

interface HudProps {
  score: number;
  mapsCleared: number;
  timeLeftMs: number;
  /** Maximum time for the current session — used to size the timer bar. */
  maxTimeMs: number;
  /** Result of the most recently cleared map; null before first clear. */
  lastResult: MapResult | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function formatMs(ms: number): string {
  const total = Math.max(0, ms);
  const s = Math.floor(total / 1000);
  const tenths = Math.floor((total % 1000) / 100);
  return `${s}.${tenths}`;
}

function padScore(n: number): string {
  return String(n).padStart(6, '0');
}

const MEDAL_STYLES: Record<Medal, string> = {
  gold:   'text-[var(--color-medal-gold)]   border-[var(--color-medal-gold)]',
  silver: 'text-[var(--color-medal-silver)] border-[var(--color-medal-silver)]',
  bronze: 'text-[var(--color-medal-bronze)] border-[var(--color-medal-bronze)]',
  none:   'text-[var(--color-text-muted)]   border-[var(--color-text-muted)]',
};

const MEDAL_LABEL: Record<Medal, string> = {
  gold:   'GOLD',
  silver: 'SLVR',
  bronze: 'BRNZ',
  none:   'NONE',
};

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function TimerBar({
  timeLeftMs,
  maxTimeMs,
}: {
  timeLeftMs: number;
  maxTimeMs: number;
}) {
  const ratio = maxTimeMs > 0 ? Math.min(1, Math.max(0, timeLeftMs / maxTimeMs)) : 0;
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
      aria-label="Time remaining"
      aria-valuenow={Math.round(timeLeftMs / 1000)}
      aria-valuemin={0}
      aria-valuemax={Math.round(maxTimeMs / 1000)}
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

function MedalPop({ result }: { result: MapResult }) {
  const { medal, used, par } = result;
  const effPct = par > 0 ? Math.round((par / Math.max(1, used)) * 100) : 0;

  return (
    <div
      className={clsx(
        'animate-pop-in',
        'inline-flex flex-col items-center gap-1',
        'border-2 px-3 py-2',
        MEDAL_STYLES[medal],
      )}
      aria-label={`${MEDAL_LABEL[medal]} medal — ${effPct}% efficiency`}
    >
      <span className="font-['Press_Start_2P'] text-[9px] leading-none">
        {MEDAL_LABEL[medal]}
      </span>
      <span className="font-['Press_Start_2P'] text-[8px] leading-none opacity-80">
        {effPct}%
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HUD                                                                  */
/* ------------------------------------------------------------------ */

/**
 * Game heads-up display.
 *
 * Contract: score, mapsCleared, timeLeftMs, maxTimeMs, lastResult.
 * No additions beyond contract.
 */
export default function Hud({
  score,
  mapsCleared,
  timeLeftMs,
  maxTimeMs,
  lastResult,
}: HudProps) {
  const isLow = maxTimeMs > 0 && timeLeftMs / maxTimeMs <= 0.25;

  return (
    <header
      className="w-full bg-[var(--color-arcade-panel)] border-b-4 border-[var(--color-accent)] px-4 py-3"
      aria-label="Game status"
    >
      {/* Top row: SCORE | MAP# | MEDAL pop */}
      <div className="flex items-center justify-between gap-4 mb-3">
        {/* Score */}
        <div className="flex flex-col gap-1">
          <span className="font-['Press_Start_2P'] text-[8px] text-[var(--color-text-muted)] uppercase tracking-widest">
            Score
          </span>
          <span className="font-['Press_Start_2P'] text-base text-[var(--color-fg)] tabular-nums">
            {padScore(score)}
          </span>
        </div>

        {/* Medal pop — only shown when there is a result */}
        {lastResult && lastResult.medal !== 'none' && (
          <MedalPop result={lastResult} />
        )}

        {/* Maps cleared */}
        <div className="flex flex-col items-end gap-1">
          <span className="font-['Press_Start_2P'] text-[8px] text-[var(--color-text-muted)] uppercase tracking-widest">
            Maps
          </span>
          <span className="font-['Press_Start_2P'] text-base text-[var(--color-fg)] tabular-nums">
            {String(mapsCleared).padStart(3, '0')}
          </span>
        </div>
      </div>

      {/* Timer row */}
      <div className="flex items-center gap-3">
        <span
          className={clsx(
            'font-["Press_Start_2P"] text-xs tabular-nums shrink-0',
            isLow
              ? 'text-[var(--color-timer-low)] animate-timer-low'
              : 'text-[var(--color-timer-ok)]',
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {formatMs(timeLeftMs)}s
        </span>

        <TimerBar timeLeftMs={timeLeftMs} maxTimeMs={maxTimeMs} />
      </div>
    </header>
  );
}
