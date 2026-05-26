import { useEffect, useRef } from 'react';
import type { UseGameReturn } from '@/game/useGame';
import { normalizeUsername, MAX_USERNAME_LEN } from '@/game/storage';
import Grid from '@/components/Grid';
import Button from '@/components/Button';
import Panel from '@/components/Panel';
import KeyHints from '@/components/KeyHints';

interface StartScreenProps {
  game: UseGameReturn;
  reducedMotion: boolean;
}

export default function StartScreen({ game, reducedMotion }: StartScreenProps) {
  const { start, map, cursor, highScore, username, setUsername } = game;
  const inputRef = useRef<HTMLInputElement>(null);

  const canStart = normalizeUsername(username).length > 0;

  function handleStart() {
    if (canStart) {
      start();
    } else {
      inputRef.current?.focus();
    }
  }

  // Enter or Space starts the game — but only when the name field isn't focused,
  // so the player can type (including spaces) freely. Enter *inside* the field
  // is handled by the input's own onKeyDown below.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (document.activeElement === inputRef.current) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleStart();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // handleStart closes over canStart/start which are stable enough per render;
    // re-subscribing each render keeps the closure fresh and is cheap here.
  });

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-8"
      role="main"
    >
      <h1 className="text-4xl font-bold tracking-widest uppercase" aria-label="VimRace">
        VimRace
      </h1>

      <p className="text-sm text-[var(--color-text-muted)] tracking-wide text-center max-w-xs">
        Navigate the maze to the <span className="text-[var(--color-goal)]">&#9873; flag</span> before the clock runs out.
        Walls block <kbd>h</kbd><kbd>j</kbd><kbd>k</kbd><kbd>l</kbd> — but <kbd>w</kbd><kbd>b</kbd><kbd>e</kbd> hop right over them.
        Fewer keystrokes earns bigger bonuses and medals.
      </p>

      {highScore > 0 && (
        <p className="text-[var(--color-goal)] font-bold text-lg" aria-live="polite">
          High Score: {highScore.toLocaleString()}
        </p>
      )}

      <Grid map={map} cursor={cursor} reducedMotion={reducedMotion} />

      <Panel>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3 text-center">Controls</h2>
        <KeyHints />
      </Panel>

      {/* Name entry — required before a run so scores land on the leaderboard. */}
      <div className="flex flex-col items-center gap-2">
        <label
          htmlFor="vimrace-username"
          className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]"
        >
          Enter your name
        </label>
        <input
          ref={inputRef}
          id="vimrace-username"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_USERNAME_LEN}
          value={username}
          placeholder="player1"
          aria-label="Player name"
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleStart();
            }
          }}
          className="w-48 text-center font-mono uppercase tracking-widest bg-[var(--color-bg)] border border-[var(--color-text-dim)] rounded px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:outline-none"
        />
      </div>

      <Button onClick={handleStart} variant="primary" disabled={!canStart}>
        Start Game
      </Button>

      <p className="text-xs text-[var(--color-text-muted)]">
        {canStart ? (
          <>
            Press <kbd className="px-1 border border-[var(--color-text-dim)] rounded">Enter</kbd> to begin
          </>
        ) : (
          'Enter a name to begin'
        )}
      </p>
    </div>
  );
}
