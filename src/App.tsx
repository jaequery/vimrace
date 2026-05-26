import { useReducedMotion } from './hooks/useReducedMotion';
import { useGame } from '@/game/useGame';
import StartScreen from '@/screens/StartScreen';
import PlayScreen from '@/screens/PlayScreen';
import GameOverScreen from '@/screens/GameOverScreen';

/**
 * Root application component. Routes by game status to the appropriate screen.
 * All game state lives in useGame — screens are pure containers.
 */
export default function App() {
  const game = useGame();
  const reducedMotion = useReducedMotion();

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
        {game.status === 'idle' && (
          <StartScreen game={game} reducedMotion={reducedMotion} />
        )}
        {game.status === 'playing' && (
          <PlayScreen game={game} reducedMotion={reducedMotion} />
        )}
        {game.status === 'gameover' && <GameOverScreen game={game} />}
      </div>
    </>
  );
}
