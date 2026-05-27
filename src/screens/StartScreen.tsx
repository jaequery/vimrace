import { useEffect, useRef, useState } from 'react';
import type { UseGameReturn } from '@/game/useGame';
import { normalizeUsername, MAX_USERNAME_LEN } from '@/game/storage';
import { MAX_LEVEL } from '@/game/scoring';
import Grid from '@/components/Grid';
import Button from '@/components/Button';
import Panel from '@/components/Panel';
import KeyHints from '@/components/KeyHints';
import Leaderboard from '@/components/Leaderboard';

interface StartScreenProps {
  game: UseGameReturn;
  reducedMotion: boolean;
  /** open the insert-mode practice subsystem */
  onOpenPractice: () => void;
}

export default function StartScreen({ game, reducedMotion, onOpenPractice }: StartScreenProps) {
  const { start, map, cursor, highScore, username, setUsername, highestUnlockedLevel } = game;
  const inputRef = useRef<HTMLInputElement>(null);

  // Default the picker to the furthest level the player has unlocked.
  const [selectedLevel, setSelectedLevel] = useState(highestUnlockedLevel);
  // Keep selection valid if unlocked progress changes (e.g. after a run).
  useEffect(() => {
    setSelectedLevel((cur) => Math.min(Math.max(1, cur), highestUnlockedLevel));
  }, [highestUnlockedLevel]);

  const canStart = normalizeUsername(username).length > 0;

  function handleStart() {
    if (canStart) {
      start(selectedLevel);
    } else {
      inputRef.current?.focus();
    }
  }

  // Enter or Space starts the game — but only when the name field isn't focused,
  // so the player can type (including spaces) freely.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const active = document.activeElement;
      // Don't steal typing in the name field, and let a focused button (e.g.
      // "Practice Insert Mode") handle its own Enter/Space activation.
      if (active === inputRef.current || active instanceof HTMLButtonElement) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleStart();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-8"
      role="main"
    >
      <h1 className="text-4xl font-bold tracking-widest uppercase" aria-label="VimRace">
        VimRace
      </h1>

      <p className="text-sm text-[var(--color-text-muted)] tracking-wide text-center max-w-md">
        Race the clock through each level&apos;s mazes to the{' '}
        <span className="text-[var(--color-goal)]">&#9873; flag</span>. Finish before the
        limit and your time hits the leaderboard. Walls block{' '}
        <kbd>h</kbd><kbd>j</kbd><kbd>k</kbd><kbd>l</kbd> — but <kbd>w</kbd><kbd>b</kbd><kbd>e</kbd>{' '}
        hop right over them. Higher levels, tighter limits.
      </p>

      {highScore > 0 && (
        <p className="text-[var(--color-goal)] font-bold text-lg" aria-live="polite">
          High Score: {highScore.toLocaleString()}
        </p>
      )}

      <Grid map={map} cursor={cursor} reducedMotion={reducedMotion} />

      {/* Level picker — start from any level you've unlocked. */}
      <Panel>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3 text-center">
          Select Level
        </h2>
        <div
          className="grid grid-cols-10 gap-1.5 max-w-md"
          role="radiogroup"
          aria-label="Starting level"
        >
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((lvl) => {
            const unlocked = lvl <= highestUnlockedLevel;
            const selected = lvl === selectedLevel;
            return (
              <button
                key={lvl}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Level ${lvl}${unlocked ? '' : ' (locked)'}`}
                disabled={!unlocked}
                onClick={() => setSelectedLevel(lvl)}
                className={
                  'font-["Press_Start_2P"] text-[10px] tabular-nums aspect-square flex items-center justify-center border-2 rounded transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] ' +
                  (selected
                    ? 'bg-[var(--color-accent)] border-[var(--color-accent-hover)] text-white'
                    : unlocked
                    ? 'border-[var(--color-text-dim)] text-[var(--color-fg)] hover:border-[var(--color-fg)] cursor-pointer'
                    : 'border-[var(--color-tile-border)] text-[var(--color-text-dim)] opacity-40 cursor-not-allowed')
                }
              >
                {lvl}
              </button>
            );
          })}
        </div>
        {highestUnlockedLevel < MAX_LEVEL && (
          <p className="text-xs text-[var(--color-text-dim)] mt-2 text-center">
            Clear a level to unlock the next.
          </p>
        )}
      </Panel>

      <Panel>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3 text-center">Controls</h2>
        <KeyHints />
      </Panel>

      {/* Name entry — required before a run so times land on the leaderboard. */}
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
        Start — Level {selectedLevel}
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

      {/* Insert-mode practice — no name required; learn the i/a/o/I/A/O commands. */}
      <Button onClick={onOpenPractice} variant="secondary">
        Practice Insert Mode
      </Button>

      <Leaderboard
        levels={[selectedLevel]}
        currentUsername={username}
        showOverall
        title={`Level ${selectedLevel} — Fastest Times`}
      />
    </div>
  );
}
