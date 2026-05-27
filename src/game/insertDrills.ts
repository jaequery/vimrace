/**
 * insertDrills.ts — the catalogue of insert-mode practice drills.
 *
 * Each drill isolates one of the six ways to enter insert mode (i/a/I/A/o/O).
 * The player starts from `start`, uses the drill's `command`, types `typeText`,
 * and presses ESC to reach `goal`. `start`/`goal` are line arrays so multi-line
 * drills (o/O) work the same way as single-line ones.
 */

import type { InsertCommand } from '@/game/insertEngine';

export interface InsertDrill {
  /** stable id, also used as the menu key (equals the command for now) */
  id: string;
  /** the insert command this drill teaches */
  command: InsertCommand;
  /** short menu label, e.g. "i — insert before cursor" */
  label: string;
  /** one-line explanation of what the command does */
  description: string;
  /** the buffer the drill starts from */
  start: string[];
  /** the buffer the player must produce (then ESC) to finish */
  goal: string[];
  /** the literal text the player should type while in insert mode */
  typeText: string;
}

/**
 * Ordered list of drills — also the order shown in the practice menu.
 * The cursor starts at row 0, column 0 for every drill, so each `command`
 * lands the caret exactly where `typeText` needs to go.
 */
export const INSERT_DRILLS: readonly InsertDrill[] = [
  {
    id: 'i',
    command: 'i',
    label: 'i — insert before cursor',
    description: 'Enter insert mode just before the character under the cursor.',
    start: ['ello'],
    goal: ['Hello'],
    typeText: 'H',
  },
  {
    id: 'a',
    command: 'a',
    label: 'a — append after cursor',
    description: 'Enter insert mode just after the character under the cursor.',
    start: ['H'],
    goal: ['Hi'],
    typeText: 'i',
  },
  {
    id: 'I',
    command: 'I',
    label: 'I — insert at first non-blank',
    description: 'Jump to the first non-blank character of the line, then insert.',
    start: ['  end'],
    goal: ['  the end'],
    typeText: 'the ',
  },
  {
    id: 'A',
    command: 'A',
    label: 'A — append at end of line',
    description: 'Jump to the very end of the line, then append.',
    start: ['Hello'],
    goal: ['Hello!'],
    typeText: '!',
  },
  {
    id: 'o',
    command: 'o',
    label: 'o — open line below',
    description: 'Open a fresh line below the cursor and insert there.',
    start: ['line one'],
    goal: ['line one', 'line two'],
    typeText: 'line two',
  },
  {
    id: 'O',
    command: 'O',
    label: 'O — open line above',
    description: 'Open a fresh line above the cursor and insert there.',
    start: ['line two'],
    goal: ['line one', 'line two'],
    typeText: 'line one',
  },
] as const;

/** Drill lookup by id, for the practice hook. */
export const DRILLS_BY_ID: Readonly<Record<string, InsertDrill>> = Object.fromEntries(
  INSERT_DRILLS.map((d) => [d.id, d]),
);
