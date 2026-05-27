/**
 * insertEngine.ts — pure insert-mode buffer logic for VimRace practice.
 *
 * This is the insert-mode counterpart to `vimEngine.ts`. Where `vimEngine`
 * moves a cursor around a maze, this models a small **text buffer** the player
 * edits: a list of lines, a `{row,col}` caret, and a `mode` that flips between
 * `'normal'` and `'insert'`.
 *
 * Vim semantics implemented (the six ways to enter insert mode):
 *   i  insert BEFORE the cursor
 *   a  append AFTER the cursor
 *   I  insert before the first non-blank char of the line
 *   A  append at the END of the line
 *   o  open a new line BELOW and insert there
 *   O  open a new line ABOVE and insert there
 *
 * `col` is a caret index in `0..line.length` — the gap where the next typed
 * character lands. In normal mode the caret conceptually sits *on* the
 * character at `col`; in insert mode it sits *between* characters. Everything
 * here is pure (no DOM, no React) so it is trivially unit-testable, mirroring
 * the `vimEngine` design.
 */

export type InsertMode = 'normal' | 'insert';

/** The six commands that enter insert mode. */
export type InsertCommand = 'i' | 'a' | 'I' | 'A' | 'o' | 'O';

/** Caret position within the buffer. `row` 0 = first line, `col` = caret index. */
export interface BufferPos {
  row: number;
  col: number;
}

/**
 * A snapshot of the practice buffer. Treated as immutable — every operation
 * returns a fresh `InsertState` rather than mutating in place.
 */
export interface InsertState {
  /** the buffer, one string per line (always at least one line) */
  lines: string[];
  /** caret position */
  cursor: BufferPos;
  /** current editing mode */
  mode: InsertMode;
  /**
   * Cumulative count of printable characters typed while in insert mode this
   * session. Measures typing activity — Backspace corrections do NOT decrement
   * it (a keystroke was still made).
   */
  typed: number;
}

// ---------------------------------------------------------------------------
// Construction & queries
// ---------------------------------------------------------------------------

/** Fresh state for the given starting lines, caret at the top-left, normal mode. */
export function createState(lines: string[]): InsertState {
  // Defensive copy so callers can't mutate our internal array, and guarantee
  // at least one (possibly empty) line so `lines[row]` is always defined.
  const copy = lines.length > 0 ? [...lines] : [''];
  return { lines: copy, cursor: { row: 0, col: 0 }, mode: 'normal', typed: 0 };
}

/** The buffer as a single newline-joined string. */
export function textOf(state: InsertState): string {
  return state.lines.join('\n');
}

/**
 * True when the buffer matches `goal` *and* the player is back in normal mode.
 * Requiring normal mode bakes "press ESC to finish" into completion — a drill
 * is not done until the player has left insert mode.
 */
export function matchesGoal(state: InsertState, goal: string[]): boolean {
  if (state.mode !== 'normal') return false;
  if (state.lines.length !== goal.length) return false;
  return state.lines.every((line, i) => line === goal[i]);
}

// ---------------------------------------------------------------------------
// Entering insert mode (i / a / I / A / o / O)
// ---------------------------------------------------------------------------

/** Index of the first non-whitespace character, or 0 if the line is blank/empty. */
function firstNonBlank(line: string): number {
  const idx = line.search(/\S/);
  return idx === -1 ? 0 : idx;
}

/**
 * Apply one of the six insert commands. In normal mode it positions the caret
 * per Vim semantics and flips to insert mode; for `o`/`O` it also opens a new
 * blank line. A no-op if already in insert mode (you can't `i` while inserting).
 */
export function enterInsert(state: InsertState, command: InsertCommand): InsertState {
  if (state.mode === 'insert') return state;

  const { row } = state.cursor;
  const line = state.lines[row];

  switch (command) {
    case 'i':
      return { ...state, mode: 'insert' };

    case 'a':
      // Caret moves one right, clamped to end of line (handles empty lines).
      return {
        ...state,
        mode: 'insert',
        cursor: { row, col: Math.min(state.cursor.col + 1, line.length) },
      };

    case 'I':
      return { ...state, mode: 'insert', cursor: { row, col: firstNonBlank(line) } };

    case 'A':
      return { ...state, mode: 'insert', cursor: { row, col: line.length } };

    case 'o': {
      // Open a blank line below and land on it.
      const lines = [...state.lines];
      lines.splice(row + 1, 0, '');
      return { ...state, lines, mode: 'insert', cursor: { row: row + 1, col: 0 } };
    }

    case 'O': {
      // Open a blank line above and land on it (caret row unchanged numerically).
      const lines = [...state.lines];
      lines.splice(row, 0, '');
      return { ...state, lines, mode: 'insert', cursor: { row, col: 0 } };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Editing while in insert mode
// ---------------------------------------------------------------------------

/** Insert a single printable character at the caret. No-op outside insert mode. */
export function typeChar(state: InsertState, ch: string): InsertState {
  if (state.mode !== 'insert') return state;

  const { row, col } = state.cursor;
  const line = state.lines[row];
  const next = line.slice(0, col) + ch + line.slice(col);

  const lines = [...state.lines];
  lines[row] = next;

  return {
    ...state,
    lines,
    cursor: { row, col: col + 1 },
    typed: state.typed + ch.length,
  };
}

/**
 * Delete the character before the caret. At column 0 it joins the current line
 * onto the previous one (Vim-style). No-op outside insert mode or at the very
 * start of the buffer.
 */
export function backspace(state: InsertState): InsertState {
  if (state.mode !== 'insert') return state;

  const { row, col } = state.cursor;

  if (col > 0) {
    const line = state.lines[row];
    const next = line.slice(0, col - 1) + line.slice(col);
    const lines = [...state.lines];
    lines[row] = next;
    return { ...state, lines, cursor: { row, col: col - 1 } };
  }

  // col === 0 — merge into the previous line, if any.
  if (row > 0) {
    const prev = state.lines[row - 1];
    const merged = prev + state.lines[row];
    const lines = [...state.lines];
    lines.splice(row - 1, 2, merged);
    return { ...state, lines, cursor: { row: row - 1, col: prev.length } };
  }

  return state;
}

/**
 * Leave insert mode. Mirrors Vim by nudging the caret one column left (clamped
 * to 0). A no-op if already in normal mode.
 */
export function escapeInsert(state: InsertState): InsertState {
  if (state.mode !== 'insert') return state;
  return {
    ...state,
    mode: 'normal',
    cursor: { row: state.cursor.row, col: Math.max(0, state.cursor.col - 1) },
  };
}

// ---------------------------------------------------------------------------
// Keyboard reducer (single source of truth for both the hook and its tests)
// ---------------------------------------------------------------------------

/** Normal-mode keys that enter insert mode, keyed by raw `KeyboardEvent.key`. */
const COMMAND_KEYS: Record<string, InsertCommand> = {
  i: 'i',
  a: 'a',
  I: 'I',
  A: 'A',
  o: 'o',
  O: 'O',
};

/** Outcome of feeding one key to the buffer. */
export interface KeyResult {
  /** the resulting buffer state */
  state: InsertState;
  /** whether the key was a recognized practice key (callers should preventDefault) */
  handled: boolean;
}

/**
 * Apply a single `KeyboardEvent.key` to the buffer. Pure and DOM-free: the
 * caller is responsible for filtering modified combos (Ctrl/Meta/Alt) before
 * calling, and for calling `preventDefault()` when `handled` is true.
 *
 *   insert mode: Escape → normal, Backspace → delete, Enter → swallowed (no-op),
 *                any single printable char → typed into the buffer.
 *   normal mode: i/a/I/A/o/O → enter insert mode; everything else is ignored.
 */
export function reduceKey(state: InsertState, key: string): KeyResult {
  if (state.mode === 'insert') {
    if (key === 'Escape') return { state: escapeInsert(state), handled: true };
    if (key === 'Backspace') return { state: backspace(state), handled: true };
    // Swallow Enter so it can't submit anything; drills use o/O for new lines.
    if (key === 'Enter') return { state, handled: true };
    if (key.length === 1) return { state: typeChar(state, key), handled: true };
    return { state, handled: false };
  }

  const command = COMMAND_KEYS[key];
  if (command !== undefined) return { state: enterInsert(state, command), handled: true };
  return { state, handled: false };
}
