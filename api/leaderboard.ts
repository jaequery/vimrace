/**
 * GET /api/leaderboard?levels=1,2,3 — top scores per level.
 *
 * `levels` is a comma-separated list of level numbers; out-of-range or
 * malformed entries are ignored. With no `levels` param we default to level 1.
 *
 * Response: { boards: { [level: number]: { username: string; score: number }[] } }
 * Each board is sorted highest-score-first, capped at the top 10.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MAX_LEVEL, normalizeLevel, readLevelBoard } from './_redis';
import type { LeaderboardEntry } from './_redis';

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

  try {
    const results = await Promise.all(levels.map((level) => readLevelBoard(level)));
    const boards: Record<number, LeaderboardEntry[]> = {};
    levels.forEach((level, i) => {
      boards[level] = results[i];
    });
    // Short edge cache: leaderboards tolerate a little staleness.
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    res.status(200).json({ boards });
  } catch (err) {
    console.error('[api/leaderboard] redis error', err);
    res.status(502).json({ error: 'Leaderboard storage unavailable' });
  }
}
