import { MOTIONS, MOTION_HELP, type Motion } from '@/game/types';
import Panel from './Panel';

/** Single keycap item in the cheat-sheet. */
function Keycap({ motion }: { motion: Motion }) {
  const label = motion === '$' ? '$' : motion;
  const help = MOTION_HELP[motion];

  return (
    <li className="flex items-center gap-2 min-w-0">
      {/* The key itself */}
      <span
        aria-hidden="true"
        className={[
          'shrink-0',
          'inline-flex items-center justify-center',
          'w-8 h-8',
          'font-["Press_Start_2P"] text-[10px] leading-none',
          'bg-[var(--color-arcade-surface)] text-[var(--color-cursor)]',
          'border-[3px] border-[var(--color-cursor)]',
          'shadow-[0_4px_0_0_#000]',
        ].join(' ')}
      >
        {label}
      </span>

      {/* Description */}
      <span className="text-[11px] text-[var(--color-text-primary)] font-mono truncate">
        {help}
      </span>
    </li>
  );
}

/**
 * On-screen motion cheat-sheet.
 *
 * Reads MOTIONS and MOTION_HELP directly from `@/game/types` — no props needed.
 * Contract: `<KeyHints />` — no required props.
 */
export default function KeyHints() {
  return (
    <Panel title="Controls" aria-label="Vim motion cheat-sheet">
      <ul
        role="list"
        className="grid grid-cols-[1fr_1fr] gap-x-4 gap-y-2"
        aria-label="Vim motions"
      >
        {MOTIONS.map((m) => (
          <Keycap key={m} motion={m} />
        ))}
      </ul>
    </Panel>
  );
}
