import { useEffect } from 'react';
import type { UseGameReturn } from '@/game/useGame';
import { MAX_LEVEL } from '@/game/scoring';
import Button from '@/components/Button';
import Leaderboard from '@/components/Leaderboard';

interface LevelCompleteScreenProps {
  game: UseGameReturn;
}

export default function LevelCompleteScreen({ game }: LevelCompleteScreenProps) {
  const { level, username, timesByLevel, nextLevel, reset } = game;

  const isFinalLevel = level >= MAX_LEVEL;

  // Enter / Space advances to the next level (or, on the final level, does nothing).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!isFinalLevel) nextLevel();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [nextLevel, isFinalLevel]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-8"
      role="main"
      aria-label="Level complete screen"
    >
      <h1 className="text-4xl font-bold tracking-widest uppercase text-[var(--color-goal)] text-center">
        {isFinalLevel ? 'VimRace Complete!' : `Level ${level} Clear!`}
      </h1>

      {username && (
        <p className="text-sm text-[var(--color-text-muted)] tracking-widest uppercase">
          {username}
        </p>
      )}

      <Leaderboard
        levels={[level]}
        currentUsername={username}
        timesByLevel={timesByLevel}
        title={`Level ${level} — Fastest Times`}
      />

      <div className="flex flex-col items-center gap-3">
        {!isFinalLevel ? (
          <Button onClick={nextLevel} variant="primary">
            Next Level →
          </Button>
        ) : (
          <p className="text-[var(--color-goal)] font-bold text-center max-w-xs">
            You cleared every level. Legendary.
          </p>
        )}
        <button
          onClick={reset}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:outline-none rounded"
        >
          Return to Start
        </button>
      </div>

      {!isFinalLevel && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Press <kbd className="px-1 border border-[var(--color-text-dim)] rounded">Enter</kbd> for the next level
        </p>
      )}
    </div>
  );
}
