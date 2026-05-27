import type { UsePracticeReturn } from '@/game/usePractice';
import Button from '@/components/Button';
import Panel from '@/components/Panel';

interface PracticeMenuScreenProps {
  practice: UsePracticeReturn;
  /** return to the start screen (race) */
  onExit: () => void;
}

/**
 * Practice menu — lists the available insert-mode drills. Picking one opens it
 * in the InsertPracticeScreen. This is the "practice menu" the ticket calls for;
 * the race game remains the normal-mode practice alongside it.
 */
export default function PracticeMenuScreen({ practice, onExit }: PracticeMenuScreenProps) {
  const { drills, selectDrill } = practice;

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-8"
      role="main"
      aria-label="Insert mode practice menu"
    >
      <h1 className="text-3xl font-bold tracking-widest uppercase text-center">
        Insert Mode Practice
      </h1>

      <p className="text-sm text-[var(--color-text-muted)] tracking-wide text-center max-w-md">
        Practice the six ways to enter insert mode. Pick a drill, use the command
        to start typing, then press <kbd className="px-1 border border-[var(--color-text-dim)] rounded">Esc</kbd>{' '}
        to return to normal mode.
      </p>

      <Panel className="w-full max-w-md">
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3 text-center">
          Choose a Drill
        </h2>
        <ul role="list" className="flex flex-col gap-2">
          {drills.map((drill) => (
            <li key={drill.id}>
              <button
                type="button"
                onClick={() => selectDrill(drill.id)}
                className={[
                  'w-full text-left flex flex-col gap-1 px-3 py-2.5 rounded',
                  'border-2 border-[var(--color-text-dim)]',
                  'hover:border-[var(--color-fg)] cursor-pointer transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]',
                ].join(' ')}
              >
                <span className="font-['Press_Start_2P'] text-[11px] text-[var(--color-cursor)]">
                  {drill.label}
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                  {drill.description}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Button onClick={onExit} variant="secondary">
        ← Back to Race
      </Button>
    </div>
  );
}
