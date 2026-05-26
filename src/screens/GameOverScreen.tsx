import { useEffect } from 'react';
import type { UseGameReturn } from '@/game/useGame';
import Button from '@/components/Button';
import Panel from '@/components/Panel';

interface GameOverScreenProps {
  game: UseGameReturn;
}

export default function GameOverScreen({ game }: GameOverScreenProps) {
  const { score, mapsCleared, highScore, start, reset } = game;
  const isNewHighScore = score > 0 && score >= highScore;

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
      className="flex flex-col items-center justify-center min-h-full gap-6 px-4 py-8"
      role="main"
      aria-label="Game over screen"
    >
      <h1 className="text-4xl font-bold tracking-widest uppercase text-red-400">
        Game Over
      </h1>

      {isNewHighScore && (
        <p
          className="text-yellow-400 font-bold text-xl animate-pulse"
          aria-live="assertive"
          role="status"
        >
          New High Score!
        </p>
      )}

      <Panel>
        <dl className="flex flex-col gap-3 text-center font-mono">
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-widest">Final Score</dt>
            <dd className="text-3xl font-bold text-yellow-400">{score.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-widest">Maps Cleared</dt>
            <dd className="text-2xl font-bold">{mapsCleared}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-widest">High Score</dt>
            <dd className="text-xl font-bold text-gray-300">{highScore.toLocaleString()}</dd>
          </div>
        </dl>
      </Panel>

      <div className="flex flex-col items-center gap-3">
        <Button onClick={start} variant="primary">
          Play Again
        </Button>
        <button
          onClick={reset}
          className="text-xs text-gray-500 hover:text-gray-300 focus:outline-none focus:underline"
        >
          Return to Start
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Press <kbd className="px-1 border border-gray-600 rounded">Enter</kbd> or{' '}
        <kbd className="px-1 border border-gray-600 rounded">Space</kbd> to play again
      </p>
    </div>
  );
}
