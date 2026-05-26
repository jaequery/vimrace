import { useEffect } from 'react';
import type { UseGameReturn } from '@/game/useGame';
import Button from '@/components/Button';
import Panel from '@/components/Panel';
import Leaderboard from '@/components/Leaderboard';

interface GameOverScreenProps {
  game: UseGameReturn;
}

export default function GameOverScreen({ game }: GameOverScreenProps) {
  const {
    score,
    mapsCleared,
    highScore,
    runStartHighScore,
    lifetimeStats,
    username,
    scoresByLevel,
    start,
    reset,
  } = game;

  // Levels reached this run, highest first — the boards worth showing.
  const reachedLevels = Object.keys(scoresByLevel)
    .map(Number)
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => b - a);
  const boardLevels = reachedLevels.length > 0 ? reachedLevels : [1];
  // A genuine new record beats the high score the run started with — not a tie
  // (the reducer has already bumped `highScore` to the run's max by now).
  const isNewHighScore = score > 0 && score > runStartHighScore;

  // Enter or Space also restarts
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
      className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-8 animate-screen-shake"
      role="main"
      aria-label="Game over screen"
    >
      <h1 className="text-4xl font-bold tracking-widest uppercase text-[var(--color-timer-low)]">
        Game Over
      </h1>

      {username && (
        <p className="text-sm text-[var(--color-text-muted)] tracking-widest uppercase">
          {username}
        </p>
      )}

      {isNewHighScore && (
        <p
          className="text-[var(--color-goal)] font-bold text-xl motion-safe:animate-pulse"
          aria-live="assertive"
          role="status"
        >
          New High Score!
        </p>
      )}

      <Panel>
        <dl className="flex flex-col gap-3 text-center font-mono">
          <div>
            <dt className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">Final Score</dt>
            <dd className="text-3xl font-bold text-[var(--color-goal)]">{score.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">Maps Cleared</dt>
            <dd className="text-2xl font-bold">{mapsCleared}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">High Score</dt>
            <dd className="text-xl font-bold text-[var(--color-text-primary)]">{highScore.toLocaleString()}</dd>
          </div>
        </dl>
      </Panel>

      <Leaderboard
        levels={boardLevels}
        currentUsername={username}
        scoresByLevel={scoresByLevel}
      />

      <div className="flex flex-col items-center gap-3">
        <Button onClick={start} variant="primary">
          Play Again
        </Button>
        <button
          onClick={reset}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:outline-none rounded"
        >
          Return to Start
        </button>
      </div>

      <p className="text-xs text-[var(--color-text-dim)] font-mono">
        Lifetime: {lifetimeStats.totalMapsCleared} maps cleared &middot; {lifetimeStats.totalGamesPlayed} games
      </p>

      <p className="text-xs text-[var(--color-text-muted)]">
        Press <kbd className="px-1 border border-[var(--color-text-dim)] rounded">Enter</kbd> or{' '}
        <kbd className="px-1 border border-[var(--color-text-dim)] rounded">Space</kbd> to play again
      </p>
    </div>
  );
}
