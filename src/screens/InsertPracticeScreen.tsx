import type { UsePracticeReturn } from '@/game/usePractice';
import type { BufferPos, InsertMode } from '@/game/insertEngine';
import type { InsertDrill } from '@/game/insertDrills';
import Button from '@/components/Button';
import Panel from '@/components/Panel';

interface InsertPracticeScreenProps {
  practice: UsePracticeReturn;
  /** return to the start screen (race) */
  onExit: () => void;
}

/**
 * One line of the editable buffer. On the caret's row it renders a visible
 * caret: a blinking bar between characters in insert mode, or a block on the
 * character under the cursor in normal mode.
 */
function BufferLine({
  text,
  isCaretRow,
  col,
  mode,
}: {
  text: string;
  isCaretRow: boolean;
  col: number;
  mode: InsertMode;
}) {
  if (!isCaretRow) {
    // Non-empty content, or a zero-width space so empty lines keep their height.
    return <div className="whitespace-pre">{text === '' ? '​' : text}</div>;
  }

  if (mode === 'insert') {
    const before = text.slice(0, col);
    const after = text.slice(col);
    return (
      <div className="whitespace-pre">
        <span>{before}</span>
        <span
          aria-hidden="true"
          className="inline-block w-0 self-stretch border-l-2 border-[var(--color-cursor)] motion-safe:animate-pulse"
        />
        <span>{after}</span>
      </div>
    );
  }

  // normal mode — block highlight on the character under the cursor
  const before = text.slice(0, col);
  const under = text.slice(col, col + 1) || ' ';
  const after = text.slice(col + 1);
  return (
    <div className="whitespace-pre">
      <span>{before}</span>
      <span className="bg-[var(--color-cursor)] text-[var(--color-bg)]">{under}</span>
      <span>{after}</span>
    </div>
  );
}

function BufferView({
  lines,
  cursor,
  mode,
}: {
  lines: string[];
  cursor: BufferPos;
  mode: InsertMode;
}) {
  return (
    <div
      className="font-mono text-lg leading-relaxed text-[var(--color-text-primary)] bg-[var(--color-bg)] border-2 border-[var(--color-text-dim)] rounded px-4 py-3 min-w-[16rem]"
      aria-label="Practice buffer"
    >
      {lines.map((line, r) => (
        <BufferLine
          key={r}
          text={line}
          isCaretRow={r === cursor.row}
          col={cursor.col}
          mode={mode}
        />
      ))}
    </div>
  );
}

/** Mode badge — NORMAL (green) or INSERT (cyan), announced to screen readers. */
function ModeBadge({ mode }: { mode: InsertMode }) {
  const insert = mode === 'insert';
  return (
    <span
      role="status"
      aria-live="polite"
      className={[
        "font-['Press_Start_2P'] text-[10px] px-3 py-2 rounded border-2",
        insert
          ? 'text-[var(--color-cursor)] border-[var(--color-cursor)]'
          : 'text-[var(--color-timer-ok)] border-[var(--color-timer-ok)]',
      ].join(' ')}
    >
      {insert ? '-- INSERT --' : '-- NORMAL --'}
    </span>
  );
}

export default function InsertPracticeScreen({ practice, onExit }: InsertPracticeScreenProps) {
  const { activeDrill, lines, cursor, mode, typed, completed, resetDrill, backToMenu } = practice;

  // Container only renders this screen when a drill is active; guard anyway so
  // the types stay honest.
  if (!activeDrill) return null;
  const drill: InsertDrill = activeDrill;

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-5 px-4 py-8"
      role="main"
      aria-label={`Insert mode drill: ${drill.label}`}
    >
      <h1 className="text-2xl font-bold tracking-widest uppercase text-center">
        {drill.label}
      </h1>

      <ModeBadge mode={mode} />

      {/* Instructions */}
      <Panel className="w-full max-w-md">
        <ol className="flex flex-col gap-1.5 text-sm font-mono text-[var(--color-text-primary)] list-decimal list-inside">
          <li>
            Press{' '}
            <kbd className="px-1.5 py-0.5 border border-[var(--color-cursor)] text-[var(--color-cursor)] rounded">
              {drill.command}
            </kbd>{' '}
            <span className="text-[var(--color-text-muted)]">— {drill.description}</span>
          </li>
          <li>
            Type{' '}
            <kbd className="px-1.5 py-0.5 border border-[var(--color-text-dim)] rounded whitespace-pre">
              {drill.typeText}
            </kbd>
          </li>
          <li>
            Press{' '}
            <kbd className="px-1.5 py-0.5 border border-[var(--color-text-dim)] rounded">Esc</kbd>{' '}
            to return to normal mode
          </li>
        </ol>
      </Panel>

      {/* Live buffer + the goal to reach */}
      <div className="flex flex-wrap items-start justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
            Your buffer
          </span>
          <BufferView lines={lines} cursor={cursor} mode={mode} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
            Goal
          </span>
          <div className="font-mono text-lg leading-relaxed text-[var(--color-text-muted)] bg-[var(--color-arcade-surface)] border-2 border-dashed border-[var(--color-text-dim)] rounded px-4 py-3 min-w-[16rem]">
            {drill.goal.map((line, i) => (
              <div key={i} className="whitespace-pre">
                {line === '' ? '​' : line}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-muted)]" aria-live="polite">
        Characters typed: <span className="text-[var(--color-fg)] tabular-nums">{typed}</span>
      </p>

      {completed && (
        <p
          role="status"
          aria-live="assertive"
          className="font-['Press_Start_2P'] text-sm text-[var(--color-timer-ok)] text-center"
        >
          ✓ Drill complete!
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={resetDrill} variant="secondary">
          Reset
        </Button>
        <Button onClick={backToMenu} variant={completed ? 'primary' : 'secondary'}>
          {completed ? 'More Drills →' : '← Drills'}
        </Button>
        <Button onClick={onExit} variant="secondary">
          Exit to Race
        </Button>
      </div>
    </div>
  );
}
