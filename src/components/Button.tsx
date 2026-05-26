import { type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Defaults to 'primary'. */
  variant?: ButtonVariant;
  children: React.ReactNode;
}

/**
 * Arcade-styled chunky pixel button.
 *
 * Extras beyond the contract:
 *   - `variant?: 'primary' | 'secondary' | 'danger'`  (optional, defaults to primary)
 *
 * Required contract props: onClick, variant?, children — all preserved.
 */
export default function Button({
  variant = 'primary',
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={clsx(
        // Base — pixel font, chunky border, no border-radius beyond 2 px
        'relative inline-flex items-center justify-center',
        'font-["Press_Start_2P"] text-xs leading-none tracking-wide',
        'px-5 py-3',
        'border-[3px]',
        'transition-[box-shadow,transform] duration-[120ms]',
        'cursor-pointer select-none',
        // focus ring
        'focus-visible:outline-[3px] focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2',
        // chunky raised-key shadow
        'shadow-[0_4px_0_0_#000000cc]',
        'active:shadow-[0_2px_0_0_#000000cc] active:translate-y-[2px]',
        // disabled
        disabled && 'opacity-40 cursor-not-allowed active:shadow-[0_4px_0_0_#000000cc] active:translate-y-0',
        // variants
        variant === 'primary' && [
          'bg-[var(--color-accent)] border-[var(--color-accent-hover)] text-white',
          !disabled && 'hover:bg-[var(--color-accent-hover)]',
        ],
        variant === 'secondary' && [
          'bg-[var(--color-arcade-panel)] border-[var(--color-text-muted)] text-[var(--color-fg)]',
          !disabled && 'hover:border-[var(--color-fg)]',
        ],
        variant === 'danger' && [
          'bg-[var(--color-timer-low)] border-[#ff6659] text-white',
          !disabled && 'hover:brightness-110',
        ],
        className,
      )}
    >
      {children}
    </button>
  );
}
