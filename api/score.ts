/**
 * POST /api/score — record a player's best score per level.
 *
 * Body: { username: string, scoresByLevel: { [level: number|string]: number } }
 *
 * For each (level, score) pair we ZADD into that level's sorted set with the
 * `GT` flag, so a player's entry only ever moves up. Invalid entries are
 * skipped rather than failing the whole request; a request with no valid
 * entries is a 400.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getRedis,
  levelKey,
  normalizeLevel,
  normalizeScore,
  normalizeUsername,
} from './_redis';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Vercel parses JSON bodies automatically, but guard against string bodies.
  let body: unknown = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
  }

  if (body === null || typeof body !== 'object') {
    res.status(400).json({ error: 'Body must be an object' });
    return;
  }

  const { username: rawUsername, scoresByLevel } = body as Record<string, unknown>;

  const username = normalizeUsername(rawUsername);
  if (!username) {
    res.status(400).json({ error: 'Invalid username' });
    return;
  }

  if (scoresByLevel === null || typeof scoresByLevel !== 'object') {
    res.status(400).json({ error: 'scoresByLevel must be an object' });
    return;
  }

  // Build the list of valid (level, score) writes.
  const writes: { level: number; score: number }[] = [];
  for (const [rawLevel, rawScore] of Object.entries(
    scoresByLevel as Record<string, unknown>,
  )) {
    const level = normalizeLevel(rawLevel);
    const score = normalizeScore(rawScore);
    if (level !== null && score !== null) writes.push({ level, score });
  }

  if (writes.length === 0) {
    res.status(400).json({ error: 'No valid score entries' });
    return;
  }

  try {
    const redis = getRedis();
    // GT: only update if the new score is greater than the current one.
    await Promise.all(
      writes.map(({ level, score }) =>
        redis.zadd(levelKey(level), { gt: true }, { score, member: username }),
      ),
    );
    res.status(200).json({ ok: true, username, recorded: writes.length });
  } catch (err) {
    console.error('[api/score] redis error', err);
    res.status(502).json({ error: 'Leaderboard storage unavailable' });
  }
}
