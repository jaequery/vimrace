import clsx from 'clsx';
import { type HTMLAttributes } from 'react';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Optional semantic heading rendered inside the panel in arcade font.
   * Keep it short — Press Start 2P is wide.
   */
  title?: string;
  children: React.ReactNode;
}

/**
 * Arcade-styled bordered pixel card.
 *
 * Extras beyond the contract:
 *   - `title?: string`   — optional arcade-font heading (optional)
 *
 * Required contract prop: children — preserved.
 */
export default function Panel({
  title,
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <div
      {...rest}
      className={clsx(
        'relative bg-[var(--color-arcade-panel)]',
        'border-[4px] border-[var(--color-accent)]',
        'shadow-[4px_4px_0_#000000cc]',
        'p-4',
        className,
      )}
    >
      {title && (
        <h2
          className={clsx(
            'font-["Press_Start_2P"] text-[10px] text-[var(--color-accent)] uppercase tracking-widest',
            'mb-3 pb-2 border-b-2 border-[var(--color-accent)]',
          )}
        >
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
