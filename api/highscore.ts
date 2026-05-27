/**
 * GET /api/highscore?username=X — a single player's best overall score.
 *
 * The high score is no longer kept in the browser; it lives only in Redis (the
 * overall score board). This returns the player's current best via ZSCORE, or 0
 * if they have no recorded score yet.
 *
 * Response: { username: string, score: number }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, overallKey, normalizeUsername } from './_redis';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const username = normalizeUsername(req.query.username);
  if (!username) {
    res.status(400).json({ error: 'Invalid username' });
    return;
  }

  try {
    const redis = getRedis();
    const raw = await redis.zscore(overallKey(), username);
    const score = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 0;
    // Brief edge cache; a player's own best changes only when they submit.
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=15');
    res.status(200).json({ username, score });
  } catch (err) {
    console.error('[api/highscore] redis error', err);
    res.status(502).json({ error: 'Leaderboard storage unavailable' });
  }
}
