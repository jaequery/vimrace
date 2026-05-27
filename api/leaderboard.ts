/**
 * GET /api/leaderboard?levels=1,2,3 — fastest times per level + overall scores.
 *
 * `levels` is a comma-separated list of level numbers; out-of-range or
 * malformed entries are ignored. With no `levels` param we default to level 1.
 *
 * The optional `me` param carries the caller's own per-level times as a
 * comma-separated `level:timeMs` list (e.g. `me=3:7730,4:8200`). For each one we
 * return that player's 1-based rank on the level so the UI can show where they
 * placed even when they fall outside the top-N board.
 *
 * Response: {
 *   boards:  { [level: number]: { username: string; timeMs: number }[] },  // fastest first
 *   overall: { username: string; score: number }[],                         // highest first
 *   ranks:   { [level: number]: number }                                    // caller's 1-based rank
 * }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  MAX_LEVEL,
  normalizeLevel,
  normalizeTimeMs,
  rankByTime,
  readLevelBoard,
  readOverallBoard,
} from './_redis';
import type { ScoreEntry, TimeEntry } from './_redis';

function parseLevels(raw: VercelRequest['query']['levels']): number[] {
  const text = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
  const levels = new Set<number>();
  for (const part of text.split(',')) {
    const level = normalizeLevel(part.trim());
    if (level !== null) levels.add(level);
  }
  if (levels.size === 0) levels.add(1);
  // Cap how many boards a single request can fan out to.
  return [...levels].sort((a, b) => a - b).slice(0, MAX_LEVEL);
}

/** Parse the caller's own times: a `level:timeMs` CSV → Map<level, timeMs>. */
function parseMeTimes(raw: VercelRequest['query']['me']): Map<number, number> {
  const text = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
  const out = new Map<number, number>();
  for (const part of text.split(',')) {
    const [rawLevel, rawTime] = part.split(':');
    const level = normalizeLevel((rawLevel ?? '').trim());
    const timeMs = normalizeTimeMs((rawTime ?? '').trim());
    if (level !== null && timeMs !== null) out.set(level, timeMs);
  }
  return out;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const levels = parseLevels(req.query.levels);
  // Only rank levels we're actually returning a board for.
  const meTimes = [...parseMeTimes(req.query.me)].filter(([level]) =>
    levels.includes(level),
  );

  try {
    const [overall, results, rankPairs] = await Promise.all([
      readOverallBoard(),
      Promise.all(levels.map((level) => readLevelBoard(level))),
      Promise.all(
        meTimes.map(async ([level, timeMs]): Promise<[number, number | null]> => [
          level,
          await rankByTime(level, timeMs),
        ]),
      ),
    ]);
    const boards: Record<number, TimeEntry[]> = {};
    levels.forEach((level, i) => {
      boards[level] = results[i];
    });
    const ranks: Record<number, number> = {};
    for (const [level, rank] of rankPairs) {
      if (rank !== null) ranks[level] = rank;
    }
    // Short edge cache: leaderboards tolerate a little staleness. The `me` param
    // is part of the cache key, so each player caches their own ranked view.
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    res.status(200).json({ boards, overall: overall as ScoreEntry[], ranks });
  } catch (err) {
    console.error('[api/leaderboard] redis error', err);
    res.status(502).json({ error: 'Leaderboard storage unavailable' });
  }
}
