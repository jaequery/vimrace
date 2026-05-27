/**
 * insertEngine.test.ts — unit tests for the pure insert-mode buffer engine.
 *
 * Covers the six insert commands (i/a/I/A/o/O), typing + tracking, Backspace,
 * ESC-to-normal, goal matching, and the `reduceKey` keyboard reducer that the
 * practice hook is built on.
 */

import { describe, it, expect } from 'vitest';
import {
  createState,
  enterInsert,
  typeChar,
  backspace,
  escapeInsert,
  matchesGoal,
  reduceKey,
  textOf,
  type InsertState,
} from '@/game/insertEngine';

/** Fold a string of characters through `typeChar`, left to right. */
function typeAll(state: InsertState, text: string): InsertState {
  return [...text].reduce((s, ch) => typeChar(s, ch), state);
}

describe('createState', () => {
  it('starts in normal mode at the top-left with nothing typed', () => {
    const s = createState(['hello']);
    expect(s.mode).toBe('normal');
    expect(s.cursor).toEqual({ row: 0, col: 0 });
    expect(s.typed).toBe(0);
    expect(s.lines).toEqual(['hello']);
  });

  it('guarantees at least one line for an empty buffer', () => {
    expect(createState([]).lines).toEqual(['']);
  });

  it('copies the input so external mutation cannot leak in', () => {
    const input = ['a'];
    const s = createState(input);
    input[0] = 'mutated';
    expect(s.lines[0]).toBe('a');
  });
});

describe('enterInsert', () => {
  it('i — inserts before the cursor', () => {
    let s = createState(['ello']); // caret on the leading char
    s = enterInsert(s, 'i');
    expect(s.mode).toBe('insert');
    expect(s.cursor.col).toBe(0);
    s = typeChar(s, 'H');
    expect(textOf(s)).toBe('Hello');
  });

  it('a — appends after the cursor', () => {
    let s = createState(['H']);
    s = enterInsert(s, 'a');
    expect(s.cursor.col).toBe(1);
    s = typeChar(s, 'i');
    expect(textOf(s)).toBe('Hi');
  });

  it('a — on an empty line stays at column 0', () => {
    const s = enterInsert(createState(['']), 'a');
    expect(s.cursor.col).toBe(0);
  });

  it('A — appends at the end of the line', () => {
    let s = createState(['Hello']);
    s = enterInsert(s, 'A');
    expect(s.cursor.col).toBe(5);
    s = typeChar(s, '!');
    expect(textOf(s)).toBe('Hello!');
  });

  it('I — inserts before the first non-blank character', () => {
    let s = createState(['  end']);
    s = enterInsert(s, 'I');
    expect(s.cursor.col).toBe(2);
    s = typeAll(s, 'the ');
    expect(textOf(s)).toBe('  the end');
  });

  it('I — on a blank line falls back to column 0', () => {
    const s = enterInsert(createState(['     ']), 'I');
    expect(s.cursor.col).toBe(0);
  });

  it('o — opens a new line below', () => {
    let s = createState(['line one']);
    s = enterInsert(s, 'o');
    expect(s.cursor).toEqual({ row: 1, col: 0 });
    s = typeAll(s, 'line two');
    expect(s.lines).toEqual(['line one', 'line two']);
  });

  it('O — opens a new line above', () => {
    let s = createState(['line two']);
    s = enterInsert(s, 'O');
    expect(s.cursor).toEqual({ row: 0, col: 0 });
    s = typeAll(s, 'line one');
    expect(s.lines).toEqual(['line one', 'line two']);
  });

  it('is a no-op when already in insert mode', () => {
    const s = enterInsert(createState(['x']), 'i');
    expect(enterInsert(s, 'o')).toBe(s);
  });
});

describe('typeChar', () => {
  it('does nothing in normal mode', () => {
    const s = createState(['x']);
    expect(typeChar(s, 'y')).toBe(s);
  });

  it('tracks the number of characters typed', () => {
    let s = enterInsert(createState(['']), 'i');
    s = typeAll(s, 'abc');
    expect(s.typed).toBe(3);
    expect(textOf(s)).toBe('abc');
  });
});

describe('backspace', () => {
  it('deletes the character before the caret', () => {
    let s = enterInsert(createState(['']), 'i');
    s = typeAll(s, 'abc');
    s = backspace(s);
    expect(textOf(s)).toBe('ab');
    expect(s.cursor.col).toBe(2);
  });

  it('does not lower the typed counter (a keystroke was still made)', () => {
    let s = enterInsert(createState(['']), 'i');
    s = typeAll(s, 'ab');
    s = backspace(s);
    expect(s.typed).toBe(2);
  });

  it('joins onto the previous line at column 0', () => {
    let s = enterInsert(createState(['foo', 'bar']), 'i');
    // Park the caret at the start of the second line, then delete the boundary.
    s = { ...s, cursor: { row: 1, col: 0 } };
    s = backspace(s);
    expect(s.lines).toEqual(['foobar']);
    expect(s.cursor).toEqual({ row: 0, col: 3 });
  });

  it('is a no-op at the very start of the buffer', () => {
    const s = enterInsert(createState(['x']), 'i');
    expect(backspace(s)).toBe(s);
  });
});

describe('escapeInsert', () => {
  it('returns to normal mode and nudges the caret left', () => {
    let s = enterInsert(createState(['']), 'i');
    s = typeAll(s, 'hi');
    expect(s.cursor.col).toBe(2);
    s = escapeInsert(s);
    expect(s.mode).toBe('normal');
    expect(s.cursor.col).toBe(1);
  });

  it('clamps the caret at column 0', () => {
    const s = escapeInsert(enterInsert(createState(['x']), 'i'));
    expect(s.cursor.col).toBe(0);
  });

  it('is a no-op in normal mode', () => {
    const s = createState(['x']);
    expect(escapeInsert(s)).toBe(s);
  });
});

describe('matchesGoal', () => {
  it('is false while still in insert mode (ESC required)', () => {
    let s = enterInsert(createState(['ello']), 'i');
    s = typeChar(s, 'H');
    expect(textOf(s)).toBe('Hello');
    expect(matchesGoal(s, ['Hello'])).toBe(false); // not done until ESC
    s = escapeInsert(s);
    expect(matchesGoal(s, ['Hello'])).toBe(true);
  });

  it('compares line counts and contents', () => {
    const s = createState(['a', 'b']);
    expect(matchesGoal(s, ['a'])).toBe(false);
    expect(matchesGoal(s, ['a', 'b'])).toBe(true);
    expect(matchesGoal(s, ['a', 'c'])).toBe(false);
  });
});

describe('reduceKey', () => {
  it('enters insert mode on a command key and reports handled', () => {
    const { state, handled } = reduceKey(createState(['x']), 'a');
    expect(handled).toBe(true);
    expect(state.mode).toBe('insert');
  });

  it('ignores non-command keys in normal mode', () => {
    const s = createState(['x']);
    const { state, handled } = reduceKey(s, 'z');
    expect(handled).toBe(false);
    expect(state).toBe(s);
  });

  it('types printable characters in insert mode', () => {
    let s = enterInsert(createState(['']), 'i');
    const r = reduceKey(s, 'q');
    expect(r.handled).toBe(true);
    expect(textOf(r.state)).toBe('q');
    expect(r.state.typed).toBe(1);
  });

  it('handles Escape, Backspace and swallows Enter in insert mode', () => {
    let s = enterInsert(createState(['']), 'i');
    s = reduceKey(s, 'a').state;
    s = reduceKey(s, 'b').state;

    const enter = reduceKey(s, 'Enter');
    expect(enter.handled).toBe(true);
    expect(textOf(enter.state)).toBe('ab'); // unchanged

    const bs = reduceKey(s, 'Backspace');
    expect(bs.handled).toBe(true);
    expect(textOf(bs.state)).toBe('a');

    const esc = reduceKey(s, 'Escape');
    expect(esc.handled).toBe(true);
    expect(esc.state.mode).toBe('normal');
  });

  it('drives a full i-drill end to end', () => {
    // start "ello" → type H before it → ESC → "Hello"
    let s = createState(['ello']);
    s = reduceKey(s, 'i').state;
    s = reduceKey(s, 'H').state;
    s = reduceKey(s, 'Escape').state;
    expect(matchesGoal(s, ['Hello'])).toBe(true);
    expect(s.typed).toBe(1);
  });
});
