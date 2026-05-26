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
      className="flex flex-col items-center min-h-screen gap-4"
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

      <div className="w-full flex-1 flex items-center justify-center px-4">
        <Grid map={map} cursor={cursor} reducedMotion={reducedMotion} />
      </div>

      <div className="pb-4 px-4">
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-2 text-center">
          Vim Motions
        </p>
        <KeyHints />
      </div>
    </div>
  );
}
