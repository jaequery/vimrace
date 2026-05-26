import { useEffect } from 'react';
import type { UseGameReturn } from '@/game/useGame';
import Grid from '@/components/Grid';
import Button from '@/components/Button';
import Panel from '@/components/Panel';
import KeyHints from '@/components/KeyHints';

interface StartScreenProps {
  game: UseGameReturn;
  reducedMotion: boolean;
}

export default function StartScreen({ game, reducedMotion }: StartScreenProps) {
  const { start, map, cursor, highScore } = game;

  // Enter or Space also starts the game
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        start();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [start]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-full gap-6 px-4 py-8"
      role="main"
    >
      <h1 className="text-4xl font-bold tracking-widest uppercase" aria-label="VimRace">
        VimRace
      </h1>

      <p className="text-sm text-[var(--color-text-muted)] tracking-wide text-center max-w-xs">
        Navigate to the <span className="text-[var(--color-goal)]">&#9873; flag</span> using Vim motions before the clock runs out.
        Clearing maps adds bonus time — fewer keystrokes earns bigger bonuses and medals.
      </p>

      {highScore > 0 && (
        <p className="text-yellow-400 font-bold text-lg" aria-live="polite">
          High Score: {highScore.toLocaleString()}
        </p>
      )}

      <Grid map={map} cursor={cursor} reducedMotion={reducedMotion} />

      <Panel>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3 text-center">Controls</h2>
        <KeyHints />
      </Panel>

      <Button onClick={start} variant="primary">
        Start Game
      </Button>

      <p className="text-xs text-[var(--color-text-muted)]">
        Press <kbd className="px-1 border border-[var(--color-text-dim)] rounded">Enter</kbd> or{' '}
        <kbd className="px-1 border border-[var(--color-text-dim)] rounded">Space</kbd> to begin
      </p>
    </div>
  );
}
