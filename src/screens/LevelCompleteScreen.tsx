import { useEffect } from 'react';
import type { UseGameReturn } from '@/game/useGame';
import type { MultiplayerView } from '@/game/multiplayer';
import { MAX_LEVEL } from '@/game/scoring';
import Button from '@/components/Button';
import Leaderboard from '@/components/Leaderboard';
import OpponentsPanel from '@/components/OpponentsPanel';

interface LevelCompleteScreenProps {
  game: UseGameReturn;
  /** present when the level was cleared inside a multiplayer room */
  multiplayer?: MultiplayerView | null;
}

export default function LevelCompleteScreen({ game, multiplayer }: LevelCompleteScreenProps) {
  const { level, username, timesByLevel, mapsPerLevel, nextLevel, reset } = game;

  const isFinalLevel = level >= MAX_LEVEL;
  // In a room each player races a single level; "next level" doesn't apply.
  const inRoom = !!multiplayer;

  // Enter / Space advances to the next level (single-player only; in a room the
  // race is over and Enter does nothing).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!isFinalLevel && !inRoom) nextLevel();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [nextLevel, isFinalLevel, inRoom]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-8"
      role="main"
      aria-label="Level complete screen"
    >
      <h1 className="text-4xl font-bold tracking-widest uppercase text-[var(--color-goal)] text-center">
        {inRoom ? `Level ${level} Finished!` : isFinalLevel ? 'VimRace Complete!' : `Level ${level} Clear!`}
      </h1>

      {username && (
        <p className="text-sm text-[var(--color-text-muted)] tracking-widest uppercase">
          {username}
        </p>
      )}

      {/* In a room, the race standings are the headline; the all-time board sits
          below it. Solo, just the all-time board. */}
      {inRoom && multiplayer && (
        <OpponentsPanel
          players={multiplayer.players}
          playerId={multiplayer.playerId}
          mapsPerLevel={mapsPerLevel}
          level={level}
          title="Final Standings"
        />
      )}

      <Leaderboard
        levels={[level]}
        currentUsername={username}
        timesByLevel={timesByLevel}
        title={`Level ${level} — Fastest Times`}
      />

      <div className="flex flex-col items-center gap-3">
        {inRoom ? (
          <Button onClick={() => multiplayer?.leave()} variant="primary">
            Leave Race
          </Button>
        ) : !isFinalLevel ? (
          <Button onClick={nextLevel} variant="primary">
            Next Level →
          </Button>
        ) : (
          <p className="text-[var(--color-goal)] font-bold text-center max-w-xs">
            You cleared every level. Legendary.
          </p>
        )}
        {!inRoom && (
          <button
            onClick={reset}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:outline-none rounded"
          >
            Return to Start
          </button>
        )}
      </div>

      {!isFinalLevel && !inRoom && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Press <kbd className="px-1 border border-[var(--color-text-dim)] rounded">Enter</kbd> for the next level
        </p>
      )}
    </div>
  );
}
