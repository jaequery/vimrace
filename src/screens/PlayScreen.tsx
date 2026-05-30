import type { UseGameReturn } from '@/game/useGame';
import type { MultiplayerView } from '@/game/multiplayer';
import Grid from '@/components/Grid';
import Hud from '@/components/Hud';
import KeyHints from '@/components/KeyHints';
import RivalsPanel from '@/components/RivalsPanel';
import OpponentsPanel from '@/components/OpponentsPanel';

interface PlayScreenProps {
  game: UseGameReturn;
  reducedMotion: boolean;
  /** present while racing in a multiplayer room — swaps rivals for live opponents */
  multiplayer?: MultiplayerView | null;
}

export default function PlayScreen({ game, reducedMotion, multiplayer }: PlayScreenProps) {
  const { map, cursor, score, level, mapIndex, mapsPerLevel, elapsedMs, limitMs, username } = game;

  return (
    <div
      className="flex flex-col items-center min-h-screen gap-4"
      role="main"
      aria-label="VimRace — playing"
    >
      {/* Brief white flash on each maze clear within a level — remounts (re-fires)
          whenever the maze index advances. Auto-disabled under prefers-reduced-motion. */}
      {mapIndex > 0 && (
        <div
          key={`${level}-${mapIndex}`}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-40 animate-screen-flash"
        />
      )}

      <Hud
        level={level}
        mapIndex={mapIndex}
        mapsPerLevel={mapsPerLevel}
        elapsedMs={elapsedMs}
        limitMs={limitMs}
        score={score}
      />

      {/* Maze with the live standings alongside. In a room we race the actual
          opponents in real time; solo we race the level's fastest-times board. */}
      <div className="w-full flex-1 flex flex-wrap items-center justify-center gap-6 px-4">
        <Grid map={map} cursor={cursor} reducedMotion={reducedMotion} />
        {multiplayer ? (
          <OpponentsPanel
            players={multiplayer.players}
            playerId={multiplayer.playerId}
            mapsPerLevel={mapsPerLevel}
            level={level}
          />
        ) : (
          <RivalsPanel level={level} elapsedMs={elapsedMs} currentUsername={username} />
        )}
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
