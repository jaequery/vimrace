# VimRace ⚡

**Learn Vim motions by racing the clock.** VimRace is a single-player,
pixel-art arcade game: pilot your cursor across a grid to the ⚑ flag using
real Vim motions before the countdown runs out. Clearing maps banks score and
buys you more time — and the fewer keystrokes you use, the bigger the reward.
It's a fast, replayable way to build Vim muscle memory.

## How to play

1. Press **Start** (or `Enter` / `Space`).
2. A grid appears with your **cursor** and a **⚑ goal**. The clock is ticking.
3. Move the cursor to the flag using Vim motions:

   | Key | Motion |
   |-----|--------|
   | `h` `j` `k` `l` | left · down · up · right |
   | `w` | start of next word (this row) |
   | `b` | start of previous word (this row) |
   | `e` | end of next word (this row) |
   | `0` | first cell of the row |
   | `$` | last cell of the row |

4. Reach the flag to **bank score + bonus time** and jump to the next map.
5. **Fewer keystrokes = bigger bonus** (gold / silver / bronze medals reward
   getting near the optimal path).
6. When the clock hits **0**, the run ends. Your best score is saved locally.

> Word motions treat each **row** as an independent line of text: filled tiles
> are word-characters, blank tiles are spaces, and `w`/`b`/`e` never wrap to
> another row. This keeps the motions predictable while you learn them — the
> on-screen cheat-sheet always matches the engine's behavior.

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
