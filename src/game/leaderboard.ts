/**
 * Client for the VimRace leaderboard API (`/api/score`, `/api/leaderboard`).
 *
 * Every call is failure-tolerant: the backend is optional infrastructure, so a
 * network error or non-2xx response degrades to a no-op (submit) or an empty
 * result (fetch) instead of throwing. The game must stay fully playable with
 * the leaderboard offline — e.g. under a plain `vite dev` with no functions.
 */

export interface LeaderboardEntry {
  username: string;
  score: number;
}

/** Map of level → best run-score reached at that level during a run. */
export type ScoresByLevel = Record<number, number>;

/** Map of level → top-N entries for that level. */
export type Boards = Record<number, LeaderboardEntry[]>;

/**
 * Submit a run's per-level best scores. Resolves to true if the server
 * acknowledged the write, false on any failure (never rejects).
 */
export async function submitScores(
  username: string,
  scoresByLevel: ScoresByLevel,
): Promise<boolean> {
  if (!username || Object.keys(scoresByLevel).length === 0) return false;
  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, scoresByLevel }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch the top entries for the given levels. Resolves to an empty object on
 * any failure (never rejects).
 */
export async function fetchLeaderboard(levels: number[]): Promise<Boards> {
  if (levels.length === 0) return {};
  try {
    const qs = encodeURIComponent(levels.join(','));
    const res = await fetch(`/api/leaderboard?levels=${qs}`);
    if (!res.ok) return {};
    const data: unknown = await res.json();
    if (
      data === null ||
      typeof data !== 'object' ||
      !('boards' in data) ||
      typeof (data as { boards: unknown }).boards !== 'object'
    ) {
      return {};
    }
    return (data as { boards: Boards }).boards;
  } catch {
    return {};
  }
}
