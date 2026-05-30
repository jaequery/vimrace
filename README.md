# VimRace ⚡

**Learn Vim motions by racing the clock.** VimRace is a pixel-art arcade game:
pilot your cursor through a **maze** to the ⚑ flag using real Vim motions before
the countdown runs out. Walls block you — but the Vim "leap" motions let you hop
right over them. Clearing mazes banks score and buys you more time, and the
fewer keystrokes you use, the bigger the reward. It's a fast, replayable way to
build Vim muscle memory.

Play solo against the global leaderboard, or **race friends head-to-head** in a
shared room — same mazes, same clock, live progress, fastest finish wins.

Each level ramps the challenge: mazes grow larger **and denser**, the clock
tightens, and the ⚑ flag turns up in a different, unpredictable spot every
run — so you can't just memorize "head for the bottom-right corner."

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
- The game itself is 100% client-side; your personal best lives in
  `localStorage`. An **optional** leaderboard (Vercel serverless functions +
  Upstash Redis) records each player's best score per level — the game stays
  fully playable if it's offline.

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
│  ├─ useKeyboard.ts  #   scoped keydown → Motion handler
│  ├─ leaderboard.ts  #   failure-tolerant client for the /api endpoints
│  ├─ multiplayer.ts  #   failure-tolerant race-room client + progress helper
│  └─ useMultiplayer.ts #  room connection: playerId, poll loop, heartbeat
├─ components/        # presentational pixel-art UI (Grid, Hud, OpponentsPanel…)
├─ screens/           # Start / Play / GameOver / MultiplayerLobby containers
└─ App.tsx            # routes by game status; bridges live progress to the room

api/                  # Vercel serverless functions (leaderboard + rooms backend)
├─ _redis.ts          #   shared Upstash client + validation + ZSET/room helpers
├─ score.ts           #   POST: record a player's best score per level
├─ leaderboard.ts     #   GET:  top 10 per level
└─ room.ts            #   multiplayer: create / join / state / start / snapshot
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

`pnpm dev` runs the Vite client only — the `/api` leaderboard functions are not
served, so the leaderboard shows "unavailable" (the game still plays). To run
the functions locally, use the Vercel CLI:

```bash
vercel link               # one-time: link to the Vercel project
vercel env pull .env.local # pull Upstash credentials from the integration
vercel dev                # serves the client + /api functions together
```

## Leaderboard

Players enter a name on the start screen; on game over, their best score for
each difficulty **level** reached is recorded. Storage is one Redis sorted set
per level (`vimrace:lb:lvl:{N}`, member = username, score = best run-total at
that level), written with `ZADD … GT` so an entry only ever moves up.

Credentials come from the **Vercel ↔ Upstash** integration, which injects
`KV_REST_API_URL` and `KV_REST_API_TOKEN` into the deployment automatically —
no extra config needed in production. For local `vercel dev`, `vercel env pull`
writes them to `.env.local` (gitignored).

## Multiplayer (race rooms)

From the start screen, **Play with Friends** opens the lobby. One player
**creates** a room and shares the 4-character code; others **join** by code.
The host picks the level and starts the race — everyone then plays the *same*
mazes at the same time, sees each other's live progress in the side panel, and
gets a shared **standings** screen when they finish (fastest time wins).

**Architecture.** VimRace mazes are deterministic per `(level, mapIndex)`, so a
room never needs to sync map geometry — only each player's compact progress.
That lets multiplayer ride the existing serverless + Redis stack with **no
WebSocket server**:

- **Connection model** — plain HTTP. A "connection" is a client-side poll loop
  (~800 ms) that heartbeats your own state and pulls a roster snapshot, exactly
  mirroring the failure-tolerant leaderboard client.
- **Sync strategy** — each player publishes `{ mapIndex, progress, finished,
  finishMs }` (last-write-wins); the snapshot returns everyone's, giving a
  near-realtime "ghost" view. Map layouts are never sent. State stays
  client-authoritative — the same trust model as the leaderboard.
- **Storage** — a `vimrace:room:{code}` metadata hash plus a
  `vimrace:room:{code}:players` hash, both on a ~30-minute TTL refreshed on
  activity, so abandoned rooms self-clean. Disconnected players (no heartbeat
  within ~15 s) drop off the roster.
- **Endpoint** — one multiplexed function, `api/room.ts`:
  `POST {action: create | join | state | start}` and `GET ?code=XXXX`.

If `/api/room` is unreachable the lobby simply reports it and single-player is
completely unaffected. (Like the leaderboard, the room functions don't run under
plain `pnpm dev` unless you wire them in — use `vercel dev`, or the bundled
`vite-dev-api.ts` plugin, which serves `/api/room` against your `.env.local`
Upstash credentials.)

## License

MIT
