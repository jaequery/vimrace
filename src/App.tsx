import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useGame } from '@/game/useGame';
import { useMultiplayer } from '@/game/useMultiplayer';
import { computeLevelProgress } from '@/game/multiplayer';
import type { MultiplayerView } from '@/game/multiplayer';
import StartScreen from '@/screens/StartScreen';
import PlayScreen from '@/screens/PlayScreen';
import LevelCompleteScreen from '@/screens/LevelCompleteScreen';
import GameOverScreen from '@/screens/GameOverScreen';
import MultiplayerLobbyScreen from '@/screens/MultiplayerLobbyScreen';

/**
 * Root application component. Routes between the race game's screens by game
 * status, with a parallel multiplayer "lobby" view layered on top. Single-player
 * state lives in `useGame`; room connection + sync lives in `useMultiplayer`.
 * A small bridge publishes the local player's live progress to the room while
 * racing, so opponents see each other in real time. With the room backend
 * offline, multiplayer simply stays unreachable and single-player is untouched.
 */
export default function App() {
  const game = useGame();
  const mp = useMultiplayer();
  const reducedMotion = useReducedMotion();

  // 'solo' = the status-driven game screens; 'lobby' = the multiplayer lobby.
  const [view, setView] = useState<'solo' | 'lobby'>('solo');

  const inRoom = mp.room !== null;
  const { setLocalState, flush } = mp;

  // -------------------------------------------------------------------------
  // When the host flips the room to "racing", every client starts the local
  // race on the host's level (bypassing each player's own unlock progress).
  // -------------------------------------------------------------------------
  const startedRef = useRef(false);
  const startGame = game.start;
  useEffect(() => {
    if (!mp.room) {
      startedRef.current = false;
      return;
    }
    if (mp.room.status === 'racing' && !startedRef.current) {
      startedRef.current = true;
      setView('solo');
      startGame(mp.room.level, { ignoreUnlock: true });
    }
  }, [mp.room, startGame]);

  // -------------------------------------------------------------------------
  // Bridge: while racing in a room, keep our published state in sync with the
  // local game. The poll loop in useMultiplayer sends `localState` each tick, so
  // here we only update the ref (cheap) as the cursor / maze advances.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!inRoom || game.status !== 'playing') return;
    const progress = computeLevelProgress(
      game.map,
      game.cursor,
      game.mapIndex,
      game.mapsPerLevel,
    );
    setLocalState({ mapIndex: game.mapIndex, progress, finished: false, finishMs: null });
  }, [
    inRoom,
    game.status,
    game.cursor,
    game.map,
    game.mapIndex,
    game.mapsPerLevel,
    setLocalState,
  ]);

  // On finishing (cleared the level) or busting out, publish a final state right
  // away (flush) so opponents' standings update without waiting for a poll tick.
  useEffect(() => {
    if (!inRoom) return;
    if (game.status === 'levelcomplete' && game.lastResult) {
      setLocalState({
        mapIndex: game.mapsPerLevel - 1,
        progress: 1,
        finished: true,
        finishMs: game.lastResult.timeMs,
      });
      flush();
    } else if (game.status === 'gameover') {
      const progress = computeLevelProgress(
        game.map,
        game.cursor,
        game.mapIndex,
        game.mapsPerLevel,
      );
      setLocalState({ mapIndex: game.mapIndex, progress, finished: true, finishMs: null });
      flush();
    }
    // Deliberately keyed on status (+ the result) only: cursor/map are frozen
    // once the run ends, so this fires exactly once per terminal transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inRoom, game.status, game.lastResult]);

  // -------------------------------------------------------------------------
  // Leaving a room from any in-game screen: drop the room and reset to start.
  // -------------------------------------------------------------------------
  function handleLeaveRoom() {
    mp.leave();
    game.reset();
    setView('solo');
  }

  const multiplayerView: MultiplayerView | null = mp.room
    ? {
        room: mp.room,
        players: mp.players,
        playerId: mp.playerId,
        isHost: mp.isHost,
        leave: handleLeaveRoom,
      }
    : null;

  return (
    <>
      {/* Narrow-viewport notice — shown only when keyboard is unlikely available */}
      <div
        className="hidden max-[480px]:flex items-center justify-center min-h-full p-4 text-center text-sm text-yellow-300"
        role="alert"
        aria-live="polite"
      >
        VimRace requires a keyboard. Please play on a desktop or laptop.
      </div>

      <div className="max-[480px]:hidden flex flex-col min-h-full">
        {view === 'lobby' ? (
          <MultiplayerLobbyScreen
            multiplayer={mp}
            username={game.username}
            setUsername={game.setUsername}
            onBack={() => {
              mp.leave();
              setView('solo');
            }}
          />
        ) : (
          <>
            {game.status === 'idle' && (
              <StartScreen
                game={game}
                reducedMotion={reducedMotion}
                onMultiplayer={() => setView('lobby')}
              />
            )}
            {game.status === 'playing' && (
              <PlayScreen
                game={game}
                reducedMotion={reducedMotion}
                multiplayer={multiplayerView}
              />
            )}
            {game.status === 'levelcomplete' && (
              <LevelCompleteScreen game={game} multiplayer={multiplayerView} />
            )}
            {game.status === 'gameover' && (
              <GameOverScreen game={game} multiplayer={multiplayerView} />
            )}
          </>
        )}
      </div>
    </>
  );
}
