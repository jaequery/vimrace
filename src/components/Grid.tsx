import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
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
  /** true => wall (impassable); false => open floor */
  isWall: boolean;
  isCursor: boolean;
  isGoal: boolean;
  reducedMotion: boolean;
}

function Cell({ isWall, isCursor, isGoal, reducedMotion }: CellProps) {
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
          // Goal sits on open floor — use the floor background so it reads as
          // a reachable destination, not a wall.
          'bg-[var(--color-tile-floor)] border-2 border-[var(--color-goal)]',
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

  if (isWall) {
    // Solid, impassable wall — a raised bevel (light top/left edge, dark
    // bottom/right) makes it read as a barrier you cannot step onto.
    return (
      <div
        aria-label="wall"
        className={clsx(
          'w-full h-full',
          'bg-[var(--color-tile-filled)]',
          'border-t-2 border-l-2 border-white/15',
          'border-b-2 border-r-2 border-black/40',
        )}
      />
    );
  }

  // Open floor cell — the walkable path.
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
/** Derive tile size from container dimensions, clamped to [16, 36] px. */
function computeTileSize(
  containerW: number,
  containerH: number,
  cols: number,
  rows: number,
): number {
  // Subtract border gaps (2 px between each tile) before dividing.
  const tileFromW = Math.floor((containerW - cols * 2) / cols);
  const tileFromH = Math.floor((containerH - rows * 2) / rows);
  // Must fit BOTH dimensions — take the smaller of the two, then clamp.
  return Math.min(36, Math.max(16, Math.min(tileFromW, tileFromH)));
}

export default function Grid({ map, cursor, reducedMotion = false }: GridProps) {
  const { rows, cols, grid, goal } = map;

  // Internal layout state — tracks the container element's size so tiles
  // re-fit reactively on every viewport resize.  This is pure presentation
  // state and deliberately stays inside Grid.
  const containerRef = useRef<HTMLDivElement>(null);

  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>(() => {
    if (typeof window === 'undefined') return { w: 800, h: 560 };
    return { w: window.innerWidth * 0.9, h: window.innerHeight * 0.65 };
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    // Use ResizeObserver on the container's *parent* element so we know how
    // much space is actually available before we render the grid.
    const target = containerRef.current.parentElement ?? containerRef.current;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ w: width, h: height });
    });

    observer.observe(target);

    // Seed the size immediately from current layout.
    const rect = target.getBoundingClientRect();
    if (rect.width > 0) {
      setContainerSize({ w: rect.width, h: rect.height });
    }

    return () => observer.disconnect();
  }, []);

  const tileSize = computeTileSize(containerSize.w, containerSize.h, cols, rows);

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`,
    gridTemplateRows: `repeat(${rows}, ${tileSize}px)`,
    gap: '2px',
  };

  return (
    <div
      ref={containerRef}
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
            const isWall = grid[r]?.[c] ?? false;

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
                  isWall={isWall}
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
