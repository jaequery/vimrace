import { useEffect } from 'react';
import type { UseGameReturn } from '@/game/useGame';
import type { MultiplayerView } from '@/game/multiplayer';
import { formatTimeMs } from '@/game/format';
import Button from '@/components/Button';
import Panel from '@/components/Panel';
import Leaderboard from '@/components/Leaderboard';
import OpponentsPanel from '@/components/OpponentsPanel';

interface GameOverScreenProps {
  game: UseGameReturn;
  /** present when the run ended inside a multiplayer room */
  multiplayer?: MultiplayerView | null;
}

export default function GameOverScreen({ game, multiplayer }: GameOverScreenProps) {
  const {
    score,
    level,
    limitMs,
    highScore,
    runStartHighScore,
    lifetimeStats,
    username,
    timesByLevel,
    mapsPerLevel,
    start,
    reset,
  } = game;

  // In a room, busting out doesn't end the race for others — show the live
  // standings and let the player leave rather than silently retrying solo.
  const inRoom = !!multiplayer;

  // Boards worth showing: every level the player completed this run, plus the
  // level they ran out of time on — highest first.
  const levelSet = new Set<number>(
    Object.keys(timesByLevel).map(Number).filter(Number.isInteger),
  );
  levelSet.add(level);
  const boardLevels = [...levelSet].sort((a, b) => b - a);

  // A genuine new record beats the high score the run started with — not a tie.
  const isNewHighScore = score > 0 && score > runStartHighScore;

  // Enter / Space retries the level that ran out (single-player only).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!inRoom) start(level);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [start, level, inRoom]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-8 animate-screen-shake"
      role="main"
      aria-label="Game over screen"
    >
      <h1 className="text-4xl font-bold tracking-widest uppercase text-[var(--color-timer-low)]">
        Time&apos;s Up!
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
            <dt className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">Ran Out On</dt>
            <dd className="text-2xl font-bold text-[var(--color-timer-low)]">
              Level {level}
            </dd>
            <dd className="text-xs text-[var(--color-text-dim)]">
              limit was {formatTimeMs(limitMs)}s
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">Score</dt>
            <dd className="text-3xl font-bold text-[var(--color-goal)]">{score.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">High Score</dt>
            <dd className="text-xl font-bold text-[var(--color-text-primary)]">{highScore.toLocaleString()}</dd>
          </div>
        </dl>
      </Panel>

      {inRoom && multiplayer && (
        <OpponentsPanel
          players={multiplayer.players}
          playerId={multiplayer.playerId}
          mapsPerLevel={mapsPerLevel}
          level={level}
          title="Standings"
        />
      )}

      <Leaderboard
        levels={boardLevels}
        currentUsername={username}
        timesByLevel={timesByLevel}
        showOverall
      />

      <div className="flex flex-col items-center gap-3">
        {inRoom ? (
          <Button onClick={() => multiplayer?.leave()} variant="primary">
            Leave Race
          </Button>
        ) : (
          <>
            <Button onClick={() => start(level)} variant="primary">
              Retry Level {level}
            </Button>
            <div className="flex items-center gap-4">
              <button
                onClick={() => start(1)}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:outline-none rounded"
              >
                Play from Level 1
              </button>
              <button
                onClick={reset}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:outline-none rounded"
              >
                Return to Start
              </button>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-[var(--color-text-dim)] font-mono">
        Lifetime: {lifetimeStats.totalMapsCleared} mazes cleared &middot; {lifetimeStats.totalGamesPlayed} games
      </p>

      {!inRoom && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Press <kbd className="px-1 border border-[var(--color-text-dim)] rounded">Enter</kbd> to retry level {level}
        </p>
      )}
    </div>
  );
}
