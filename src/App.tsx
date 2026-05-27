import { useCallback, useState } from 'react';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useGame } from '@/game/useGame';
import { usePractice } from '@/game/usePractice';
import StartScreen from '@/screens/StartScreen';
import PlayScreen from '@/screens/PlayScreen';
import LevelCompleteScreen from '@/screens/LevelCompleteScreen';
import GameOverScreen from '@/screens/GameOverScreen';
import PracticeMenuScreen from '@/screens/PracticeMenuScreen';
import InsertPracticeScreen from '@/screens/InsertPracticeScreen';

/** Top-level view: the race game, or the insert-mode practice subsystem. */
type View = 'race' | 'practice';

/**
 * Root application component. Routes between the race game (by game status) and
 * the practice subsystem (a separate top-level view). All race state lives in
 * useGame; all practice state in usePractice — screens are pure containers.
 */
export default function App() {
  const game = useGame();
  const practice = usePractice();
  const reducedMotion = useReducedMotion();

  const [view, setView] = useState<View>('race');

  const openPractice = useCallback(() => setView('practice'), []);
  const exitPractice = useCallback(() => {
    practice.backToMenu();
    setView('race');
  }, [practice]);

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
        {view === 'practice' ? (
          practice.activeDrill ? (
            <InsertPracticeScreen practice={practice} onExit={exitPractice} />
          ) : (
            <PracticeMenuScreen practice={practice} onExit={exitPractice} />
          )
        ) : (
          <>
            {game.status === 'idle' && (
              <StartScreen
                game={game}
                reducedMotion={reducedMotion}
                onOpenPractice={openPractice}
              />
            )}
            {game.status === 'playing' && (
              <PlayScreen game={game} reducedMotion={reducedMotion} />
            )}
            {game.status === 'levelcomplete' && <LevelCompleteScreen game={game} />}
            {game.status === 'gameover' && <GameOverScreen game={game} />}
          </>
        )}
      </div>
    </>
  );
}
