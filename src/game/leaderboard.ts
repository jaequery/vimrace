/**
 * Client for the VimRace leaderboard API (`/api/score`, `/api/leaderboard`).
 *
 * Two boards live behind these calls:
 *   - per-level *time* boards — fastest completion time wins (ascending).
 *   - one overall *score* board — highest run score wins (descending).
 *
 * Every call is failure-tolerant: the backend is optional infrastructure, so a
 * network error or non-2xx response degrades to a no-op (submit) or an empty
 * result (fetch) instead of throwing. The game must stay fully playable with
 * the leaderboard offline — e.g. under a plain `vite dev` with no functions.
 */

/** One row on a per-level board: how long a player took to finish that level. */
export interface LeaderboardEntry {
  username: string;
  timeMs: number;
}

/** One row on the overall board: a player's best run score. */
export interface OverallEntry {
  username: string;
  score: number;
}

/** Map of level → the player's best (lowest) completion time for that level. */
export type TimesByLevel = Record<number, number>;

/** Map of level → top-N fastest entries for that level. */
export type Boards = Record<number, LeaderboardEntry[]>;

/** Map of level → the caller's own 1-based rank on that level's time board. */
export type Ranks = Record<number, number>;

/** Everything a leaderboard view needs in one fetch. */
export interface LeaderboardData {
  boards: Boards;
  overall: OverallEntry[];
  /** The caller's rank per level, present only when their own times were sent. */
  ranks: Ranks;
}

/**
 * Submit a finished run: the best completion time reached at each level plus
 * the run's total score. Resolves to true if the server acknowledged the
 * write, false on any failure (never rejects).
 */
export async function submitRun(
  username: string,
  run: { timesByLevel: TimesByLevel; score: number },
): Promise<boolean> {
  const { timesByLevel, score } = run;
  const hasTimes = Object.keys(timesByLevel).length > 0;
  if (!username || (!hasTimes && !(score > 0))) return false;
  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, timesByLevel, score }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch a single player's best overall score from the server (the high score
 * lives only in Redis, never in the browser). Resolves to 0 on any failure or
 * if the player has no recorded score yet (never rejects).
 */
export async function fetchHighScore(username: string): Promise<number> {
  if (!username) return 0;
  try {
    const res = await fetch(`/api/highscore?username=${encodeURIComponent(username)}`);
    if (!res.ok) return 0;
    const data: unknown = await res.json();
    const score = (data as { score?: unknown })?.score;
    return typeof score === 'number' && Number.isFinite(score) && score > 0 ? score : 0;
  } catch {
    return 0;
  }
}

/**
 * Fetch the fastest-time boards for the given levels plus the overall score
 * board. When `timesByLevel` is supplied, the caller's own times ride along so
 * the server can return their rank per level (`ranks`) — letting the UI place
 * the player even when they fall outside the top-N board. Resolves to empty data
 * on any failure (never rejects).
 */
export async function fetchLeaderboard(
  levels: number[],
  opts?: { timesByLevel?: TimesByLevel },
): Promise<LeaderboardData> {
  const empty: LeaderboardData = { boards: {}, overall: [], ranks: {} };
  if (levels.length === 0) return empty;
  try {
    const params = new URLSearchParams({ levels: levels.join(',') });
    const times = opts?.timesByLevel;
    if (times) {
      // Only the displayed levels, as a `level:timeMs` CSV the API understands.
      const me = levels
        .map((level) => {
          const t = times[level];
          return typeof t === 'number' ? `${level}:${Math.round(t)}` : null;
        })
        .filter((part): part is string => part !== null)
        .join(',');
      if (me) params.set('me', me);
    }
    const res = await fetch(`/api/leaderboard?${params.toString()}`);
    if (!res.ok) return empty;
    const data: unknown = await res.json();
    if (data === null || typeof data !== 'object') return empty;
    const obj = data as { boards?: unknown; overall?: unknown; ranks?: unknown };
    const boards =
      obj.boards && typeof obj.boards === 'object' ? (obj.boards as Boards) : {};
    const overall = Array.isArray(obj.overall) ? (obj.overall as OverallEntry[]) : [];
    const ranks =
      obj.ranks && typeof obj.ranks === 'object' ? (obj.ranks as Ranks) : {};
    return { boards, overall, ranks };
  } catch {
    return empty;
  }
}
