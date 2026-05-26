import { useEffect, useState } from 'react';

/**
 * Returns true if the user has requested reduced motion via
 * `prefers-reduced-motion: reduce`. Updates reactively if the preference changes.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

    function handleChange(e: MediaQueryListEvent): void {
      setReduced(e.matches);
    }

    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  return reduced;
}
