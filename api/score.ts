/**
 * POST /api/score — record a finished run.
 *
 * Body: {
 *   username: string,
 *   timesByLevel?: { [level: number|string]: number },  // ms, lower is better
 *   score?: number                                       // overall run score
 * }
 *
 * Per-level times ZADD into that level's sorted set with the `LT` flag, so a
 * player's time only ever improves (gets smaller). The overall score ZADDs into
 * the overall set with `GT`, so it only ever moves up. Invalid entries are
 * skipped; a request with nothing valid to write is a 400.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getRedis,
  levelKey,
  overallKey,
  normalizeLevel,
  normalizeScore,
  normalizeTimeMs,
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

  const {
    username: rawUsername,
    timesByLevel,
    score: rawScore,
  } = body as Record<string, unknown>;

  const username = normalizeUsername(rawUsername);
  if (!username) {
    res.status(400).json({ error: 'Invalid username' });
    return;
  }

  // Build the list of valid (level, timeMs) writes.
  const timeWrites: { level: number; timeMs: number }[] = [];
  if (timesByLevel !== null && typeof timesByLevel === 'object') {
    for (const [rawLevel, rawTime] of Object.entries(
      timesByLevel as Record<string, unknown>,
    )) {
      const level = normalizeLevel(rawLevel);
      const timeMs = normalizeTimeMs(rawTime);
      if (level !== null && timeMs !== null) timeWrites.push({ level, timeMs });
    }
  }

  const score = normalizeScore(rawScore);

  if (timeWrites.length === 0 && score === null) {
    res.status(400).json({ error: 'No valid time or score entries' });
    return;
  }

  try {
    const redis = getRedis();
    const ops: Promise<unknown>[] = timeWrites.map(({ level, timeMs }) =>
      // LT: only update if the new time is *less* than the current one.
      redis.zadd(levelKey(level), { lt: true }, { score: timeMs, member: username }),
    );
    if (score !== null) {
      // GT: only update if the new score is *greater* than the current one.
      ops.push(redis.zadd(overallKey(), { gt: true }, { score, member: username }));
    }
    await Promise.all(ops);
    res.status(200).json({
      ok: true,
      username,
      recordedTimes: timeWrites.length,
      recordedScore: score !== null,
    });
  } catch (err) {
    console.error('[api/score] redis error', err);
    res.status(502).json({ error: 'Leaderboard storage unavailable' });
  }
}
