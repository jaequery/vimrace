# VimRace ⚡

**Learn Vim motions by racing the clock.** VimRace is a single-player,
pixel-art arcade game: pilot your cursor through a **maze** to the ⚑ flag using
real Vim motions before the countdown runs out. Walls block you — but the Vim
"leap" motions let you hop right over them. Clearing mazes banks score and buys
you more time, and the fewer keystrokes you use, the bigger the reward. It's a
fast, replayable way to build Vim muscle memory.

## How to play

1. Press **Start** (or `Enter` / `Space`).
2. A maze appears with your **cursor** and a **⚑ goal**. The clock is ticking.
3. Navigate to the flag using Vim motions:

   | Key | Motion | Walls? |
   |-----|--------|--------|
   | `h` `j` `k` `l` | left · down · up · right (one cell) | **blocked** by walls |
   | `w` | hop right to the next open corridor | jumps over walls |
   | `b` | hop left to the previous corridor | jumps over walls |
   | `e` | hop to the end of a corridor | jumps over walls |
   | `0` | leftmost open cell of the row | jumps over walls |
   | `$` | rightmost open cell of the row | jumps over walls |
   | `gg` | top of the column | jumps over walls |
   | `G` | bottom of the column | jumps over walls |
   | `Ctrl-u` / `Ctrl-d` | jump ~half the maze up / down | jumps over walls |

   The row-wise leaps (`w` `b` `e` `0` `$`) move you across a row; the
   column-wise leaps (`gg` `G` `Ctrl-u` `Ctrl-d`) move you down a column —
   together they let you cross the whole maze without ever stepping cell by
   cell.

4. Reach the flag to **bank score + bonus time** and jump to the next maze.
5. **Fewer keystrokes = bigger bonus** (gold / silver / bronze medals reward
   getting near the optimal path). The leap motions are how you save
   keystrokes — learn when to hop a wall instead of stepping around it.
6. When the clock hits **0**, the run ends. Your best score is saved locally.

> `h`/`j`/`k`/`l` step one cell and **collide with walls**. The leap motions
> (`w`/`b`/`e`/`0`/`$`) operate within the current **row** only — they never
> wrap to another row — and may jump *over* walls, always landing on open
> floor. A "corridor" is a run of open cells in a row. The on-screen
> cheat-sheet always matches the engine's behavior.

VimRace is keyboard-only — play on a desktop or laptop.

## Tech stack

- **React 19** + **Vite** + **TypeScript** (strict)
- **Tailwind CSS v4** (CSS-first theming via `@theme`)
- **Vitest** + Testing Library for unit tests
- No backend, no accounts, no network — 100% client-side. High score lives in
  `localStorage`.

## Project layout

```
src/
├─ game/              # framework-free game logic (+ unit tests)
│  ├─ types.ts        #   shared contract: Pos, GameMap, Motion, MapResult…
│  ├─ vimEngine.ts    #   applyMotion / isGoalReached (pure, deterministic)
│  ├─ map.ts          #   seeded map generation + BFS par-keystroke solver
│  ├─ scoring.ts      #   score, bonus time, medals, difficulty ramp
│  ├─ storage.ts      #   localStorage high score + lifetime stats
│  ├─ useGame.ts      #   React state machine + drift-free rAF clock
│  └─ useKeyboard.ts  #   scoped keydown → Motion handler
├─ components/        # presentational pixel-art UI (Grid, Hud, KeyHints…)
├─ screens/           # Start / Play / GameOver containers
└─ App.tsx            # routes by game status
```

## Development

Requires Node 20+ and a package manager (pnpm recommended).

```bash
pnpm install      # install dependencies
pnpm dev          # start the dev server (http://localhost:5173)
pnpm test         # run the unit test suite
pnpm typecheck    # strict TypeScript check
pnpm build        # production build to dist/
pnpm preview      # preview the production build
```

## License

MIT
