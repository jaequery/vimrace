import type { UseGameReturn } from '@/game/useGame';
import Grid from '@/components/Grid';
import Hud from '@/components/Hud';
import KeyHints from '@/components/KeyHints';

interface PlayScreenProps {
  game: UseGameReturn;
  reducedMotion: boolean;
}

export default function PlayScreen({ game, reducedMotion }: PlayScreenProps) {
  const { map, cursor, score, mapsCleared, timeLeftMs, maxTimeMs, lastResult } = game;

  return (
    <div
      className="flex flex-col items-center min-h-full gap-4"
      role="main"
      aria-label="VimRace — playing"
    >
      <Hud
        score={score}
        mapsCleared={mapsCleared}
        timeLeftMs={timeLeftMs}
        maxTimeMs={maxTimeMs}
        lastResult={lastResult}
      />

      <div className="flex-1 flex items-center justify-center px-4">
        <Grid map={map} cursor={cursor} reducedMotion={reducedMotion} />
      </div>

      <div className="pb-4 px-4">
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-300 focus:outline-none focus:underline">
            Key bindings
          </summary>
          <div className="mt-2">
            <KeyHints />
          </div>
        </details>
      </div>
    </div>
  );
}
