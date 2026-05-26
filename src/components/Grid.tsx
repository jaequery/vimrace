import clsx from 'clsx';
import { type GameMap, type Pos } from '@/game/types';

interface GridProps {
  map: GameMap;
  cursor: Pos;
  /** When true, disables CSS animations on the cursor and goal cell. */
  reducedMotion?: boolean;
}

/* ------------------------------------------------------------------ */
/* Individual cell                                                      */
/* ------------------------------------------------------------------ */

interface CellProps {
  filled: boolean;
  isCursor: boolean;
  isGoal: boolean;
  reducedMotion: boolean;
}

function Cell({ filled, isCursor, isGoal, reducedMotion }: CellProps) {
  // Cursor always wins visually even if it happens to land on goal.
  if (isCursor) {
    return (
      <div
        aria-label="cursor"
        className={clsx(
          'relative flex items-center justify-center',
          'w-full h-full',
          'bg-[var(--color-cursor)]',
          'border-2 border-[var(--color-cursor)]',
          !reducedMotion && 'animate-cursor-pulse',
        )}
        style={
          reducedMotion
            ? { boxShadow: 'var(--shadow-glow-cursor)' }
            : undefined
        }
      >
        {/* Inner block — gives a "sprite" feel */}
        <span
          aria-hidden="true"
          className="absolute inset-[4px] bg-white opacity-80"
        />
      </div>
    );
  }

  if (isGoal) {
    return (
      <div
        aria-label="goal"
        className={clsx(
          'relative flex items-center justify-center overflow-hidden',
          'w-full h-full',
          'bg-[var(--color-tile-filled)] border-2 border-[var(--color-goal)]',
          !reducedMotion && 'animate-goal-glow',
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            'font-["Press_Start_2P"] text-[10px] leading-none select-none',
            'text-[var(--color-goal)]',
            !reducedMotion && 'animate-goal-bob',
          )}
        >
          ⚑
        </span>
      </div>
    );
  }

  if (filled) {
    return (
      <div
        className={clsx(
          'w-full h-full',
          'bg-[var(--color-tile-filled)]',
          'border-2 border-[var(--color-tile-border)]',
        )}
      />
    );
  }

  // Blank floor cell
  return (
    <div
      className={clsx(
        'w-full h-full',
        'bg-[var(--color-tile-floor)]',
        'border-2 border-[var(--color-tile-border)]',
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Grid                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Renders a GameMap as a pixel-art grid.
 *
 * Contract: `map`, `cursor`, `reducedMotion?` — all preserved.
 * No extra props added.
 *
 * The grid is sized via CSS Grid with `--tile-size` tokens so every cell is a
 * perfect square. On very large maps (cols > 24) the tile shrinks to ensure
 * the grid fits within a 90 vw container without horizontal scroll.
 */
export default function Grid({ map, cursor, reducedMotion = false }: GridProps) {
  const { rows, cols, grid, goal } = map;

  // Keep tiles square and bounded to ~90 vw / 70 vh.
  // We use a CSS custom property override so Tailwind doesn't need
  // to know these dimensions at compile time.
  const maxVw = typeof window !== 'undefined' ? window.innerWidth * 0.9 : 800;
  const maxVh = typeof window !== 'undefined' ? window.innerHeight * 0.65 : 560;
  const tileFromVw = Math.floor((maxVw - cols * 2) / cols); // subtract gap
  const tileFromVh = Math.floor((maxVh - rows * 2) / rows);
  const tileSize = Math.min(36, Math.max(16, tileFromVw, tileFromVh));

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`,
    gridTemplateRows: `repeat(${rows}, ${tileSize}px)`,
    gap: '2px',
  };

  return (
    <div
      role="grid"
      aria-label={`VimRace grid ${rows} rows by ${cols} columns`}
      aria-rowcount={rows}
      aria-colcount={cols}
      className="select-none"
      style={gridStyle}
    >
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} role="row" aria-rowindex={r + 1} style={{ display: 'contents' }}>
          {Array.from({ length: cols }, (_, c) => {
            const isCursor = cursor.row === r && cursor.col === c;
            const isGoal = goal.row === r && goal.col === c;
            const filled = grid[r]?.[c] ?? false;

            return (
              <div
                key={c}
                role="gridcell"
                aria-rowindex={r + 1}
                aria-colindex={c + 1}
                aria-label={
                  isCursor
                    ? `cursor row ${r + 1} col ${c + 1}`
                    : isGoal
                    ? `goal row ${r + 1} col ${c + 1}`
                    : undefined
                }
              >
                <Cell
                  filled={filled}
                  isCursor={isCursor}
                  isGoal={isGoal}
                  reducedMotion={reducedMotion}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
