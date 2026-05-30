import { useState } from 'react';
import type { UseMultiplayerReturn } from '@/game/useMultiplayer';
import { normalizeUsername, MAX_USERNAME_LEN } from '@/game/storage';
import { MAX_LEVEL } from '@/game/scoring';
import Button from '@/components/Button';
import Panel from '@/components/Panel';

interface MultiplayerLobbyScreenProps {
  multiplayer: UseMultiplayerReturn;
  username: string;
  setUsername: (value: string) => void;
  /** leave the lobby entirely and return to the single-player start screen */
  onBack: () => void;
}

/**
 * Multiplayer lobby: create or join a race room, then watch the roster fill up
 * until the host starts. Everyone races the same level → the same deterministic
 * mazes. The screen has two faces: a create/join menu before you're in a room,
 * and the room roster once you are. When the host starts, the room flips to
 * `racing` and the app transitions everyone into the game together.
 */
export default function MultiplayerLobbyScreen({
  multiplayer,
  username,
  setUsername,
  onBack,
}: MultiplayerLobbyScreenProps) {
  const { room, players, isHost, pending, error, create, join, start, leave } = multiplayer;

  const [selectedLevel, setSelectedLevel] = useState(1);
  const [joinCode, setJoinCode] = useState('');

  const canAct = normalizeUsername(username).length > 0;

  function handleCreate() {
    if (canAct) void create(username, selectedLevel);
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (canAct && code.length > 0) void join(code, username);
  }

  function handleLeaveRoom() {
    leave();
  }

  // -------------------------------------------------------------------------
  // In a room — show the roster and (for the host) the start control.
  // -------------------------------------------------------------------------
  if (room) {
    const starting = room.status === 'racing';
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-8"
        role="main"
        aria-label="Multiplayer room lobby"
      >
        <h1 className="text-3xl font-bold tracking-widest uppercase text-[var(--color-accent)]">
          Race Room
        </h1>

        <Panel className="flex flex-col items-center gap-2">
          <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
            Room Code
          </p>
          <p
            className="font-['Press_Start_2P'] text-3xl tracking-[0.3em] text-[var(--color-goal)]"
            aria-label={`Room code ${room.code.split('').join(' ')}`}
          >
            {room.code}
          </p>
          <p className="text-xs text-[var(--color-text-dim)] text-center">
            Share this code · Racing Level {room.level}
          </p>
        </Panel>

        <Panel className="w-72">
          <h2 className="font-['Press_Start_2P'] text-[10px] text-[var(--color-accent)] uppercase tracking-widest mb-3 text-center">
            Racers ({players.length})
          </h2>
          {players.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
              Connecting…
            </p>
          ) : (
            <ol className="font-mono text-sm flex flex-col gap-1">
              {players.map((p) => (
                <li
                  key={p.playerId}
                  className="flex items-baseline justify-between gap-2 px-2 py-0.5"
                >
                  <span className="truncate">
                    {p.username}
                    {p.playerId === multiplayer.playerId && (
                      <span className="text-[var(--color-text-dim)]"> (you)</span>
                    )}
                  </span>
                  {p.playerId === room.host && (
                    <span className="text-[10px] uppercase tracking-widest text-[var(--color-goal)] shrink-0">
                      host
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <div className="flex flex-col items-center gap-3">
          {starting ? (
            <p className="text-[var(--color-goal)] font-bold" aria-live="polite">
              Starting race…
            </p>
          ) : isHost ? (
            <Button onClick={() => void start()} variant="primary">
              Start Race →
            </Button>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]" aria-live="polite">
              Waiting for the host to start…
            </p>
          )}
          <button
            onClick={handleLeaveRoom}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:outline-none rounded"
          >
            Leave Room
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Not in a room yet — the create / join menu.
  // -------------------------------------------------------------------------
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-8"
      role="main"
      aria-label="Multiplayer lobby"
    >
      <h1 className="text-3xl font-bold tracking-widest uppercase">Play with Friends</h1>
      <p className="text-sm text-[var(--color-text-muted)] text-center max-w-md">
        Create a room and share the code, or join one. Everyone races the same
        mazes at the same time — fastest finish wins.
      </p>

      {/* Name entry — required before creating or joining. */}
      <div className="flex flex-col items-center gap-2">
        <label
          htmlFor="vimrace-mp-username"
          className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]"
        >
          Enter your name
        </label>
        <input
          id="vimrace-mp-username"
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_USERNAME_LEN}
          value={username}
          placeholder="player1"
          aria-label="Player name"
          onChange={(e) => setUsername(e.target.value)}
          className="w-48 text-center font-mono uppercase tracking-widest bg-[var(--color-bg)] border border-[var(--color-text-dim)] rounded px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:outline-none"
        />
      </div>

      {error && (
        <p className="text-xs text-[var(--color-timer-low)] text-center" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col md:flex-row items-stretch gap-6 w-full max-w-2xl justify-center">
        {/* Create */}
        <Panel className="flex-1 flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-center">
            Create a Room
          </h2>
          <label className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] text-center">
            Level
          </label>
          <div
            className="grid grid-cols-10 gap-1.5"
            role="radiogroup"
            aria-label="Race level"
          >
            {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((lvl) => {
              const selected = lvl === selectedLevel;
              return (
                <button
                  key={lvl}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`Level ${lvl}`}
                  onClick={() => setSelectedLevel(lvl)}
                  className={
                    'font-["Press_Start_2P"] text-[10px] tabular-nums aspect-square flex items-center justify-center border-2 rounded transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] ' +
                    (selected
                      ? 'bg-[var(--color-accent)] border-[var(--color-accent-hover)] text-white'
                      : 'border-[var(--color-text-dim)] text-[var(--color-fg)] hover:border-[var(--color-fg)] cursor-pointer')
                  }
                >
                  {lvl}
                </button>
              );
            })}
          </div>
          <Button
            onClick={handleCreate}
            variant="primary"
            disabled={!canAct || pending}
          >
            {pending ? 'Creating…' : `Create — Level ${selectedLevel}`}
          </Button>
        </Panel>

        {/* Join */}
        <Panel className="flex-1 flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-center">
            Join a Room
          </h2>
          <label
            htmlFor="vimrace-join-code"
            className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] text-center"
          >
            Room Code
          </label>
          <input
            id="vimrace-join-code"
            type="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={4}
            value={joinCode}
            placeholder="ABCD"
            aria-label="Room code"
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleJoin();
              }
            }}
            className="w-full text-center font-['Press_Start_2P'] text-xl tracking-[0.3em] bg-[var(--color-bg)] border border-[var(--color-text-dim)] rounded px-3 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:outline-none uppercase"
          />
          <Button
            onClick={handleJoin}
            variant="secondary"
            disabled={!canAct || pending || joinCode.trim().length === 0}
          >
            {pending ? 'Joining…' : 'Join Room'}
          </Button>
        </Panel>
      </div>

      {!canAct && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Enter a name to create or join a room.
        </p>
      )}

      <button
        onClick={onBack}
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:outline-none rounded"
      >
        ← Back to single player
      </button>
    </div>
  );
}
