import { MOTIONS, MOTION_HELP, type Motion } from '@/game/types';

/** Single keycap chip — compact enough for a persistent inline legend. */
function KeyChip({ motion }: { motion: Motion }) {
  const label = motion;
  const help = MOTION_HELP[motion];

  return (
    <li
      className="flex items-center gap-1.5"
      title={help}
    >
      {/* Keycap badge */}
      <kbd
        className={[
          'shrink-0',
          'inline-flex items-center justify-center',
          'w-6 h-6',
          'font-["Press_Start_2P"] text-[8px] leading-none',
          'bg-[var(--color-arcade-surface)] text-[var(--color-cursor)]',
          'border-2 border-[var(--color-cursor)]',
          'shadow-[0_3px_0_0_#000]',
          'rounded-[2px]',
        ].join(' ')}
        aria-hidden="true"
      >
        {label}
      </kbd>

      {/* Short description — hidden on very small containers via truncate */}
      <span className="text-[10px] text-[var(--color-text-muted)] font-mono leading-none truncate max-w-[5rem]">
        {help}
      </span>
    </li>
  );
}

/**
 * Persistent inline motion legend.
 *
 * Designed to sit below the grid without dominating the screen.
 * Renders as a compact flex-wrap strip of keycap chips.
 *
 * Contract: `<KeyHints />` — no required props.
 */
export default function KeyHints() {
  return (
    <nav
      aria-label="Vim motion cheat-sheet"
      className={[
        'w-full',
        'bg-[var(--color-arcade-panel)]',
        'border-t-2 border-[var(--color-accent)]',
        'px-3 py-2',
      ].join(' ')}
    >
      {/* Section label */}
      <span
        className={[
          'block mb-2',
          'font-["Press_Start_2P"] text-[7px] uppercase tracking-widest',
          'text-[var(--color-accent)]',
        ].join(' ')}
        aria-hidden="true"
      >
        Controls
      </span>

      <ul
        role="list"
        className="flex flex-wrap gap-x-4 gap-y-1.5"
        aria-label="Vim motions"
      >
        {MOTIONS.map((m) => (
          <KeyChip key={m} motion={m} />
        ))}
      </ul>
    </nav>
  );
}
