/**
 * Shared Upstash Redis client + leaderboard helpers for VimRace serverless functions.
 *
 * The REST credentials come from the Vercel ↔ Upstash integration, which injects
 * `KV_REST_API_URL` / `KV_REST_API_TOKEN` (the legacy Vercel KV names). We read
 * those explicitly rather than `Redis.fromEnv()` (which expects the
 * `UPSTASH_REDIS_REST_*` names).
 *
 * Data model — one sorted set per difficulty level:
 *   key:    vimrace:lb:lvl:{level}
 *   member: username
 *   score:  the player's best run-score recorded while at that level
 *
 * Ranking is highest-score-first (ZRANGE … REV). Writes use `GT` so a player's
 * entry only ever moves up, never down.
 */
import { Redis } from '@upstash/redis';

export const MAX_LEVEL = 20;
export const TOP_N = 10;
export const MAX_USERNAME_LEN = 16;
/** Defensive ceiling — far above any realistic single-run score. */
export const MAX_SCORE = 100_000_000;

let _redis: Redis | null = null;

/** Lazily construct a single Redis client per warm function instance. */
export function getRedis(): Redis {
  if (_redis) return _redis;

  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Missing Upstash credentials: set KV_REST_API_URL and KV_REST_API_TOKEN.',
    );
  }

  _redis = new Redis({ url, token });
  return _redis;
}

/** Sorted-set key for a given level. */
export function levelKey(level: number): string {
  return `vimrace:lb:lvl:${level}`;
}

/**
 * Normalize a raw username into a safe, display-ready handle, or return null if
 * it can't be salvaged into something valid.
 *
 * Rules: strip control characters, collapse whitespace runs to a single space,
 * trim ends, cap length. Must contain at least one visible character.
 */
export function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_USERNAME_LEN);
  if (cleaned.length === 0) return null;
  return cleaned;
}

/** Validate + clamp a score; returns null if it isn't a usable number. */
export function normalizeScore(raw: unknown): number | null {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const floored = Math.floor(n);
  if (floored < 0) return null;
  return Math.min(floored, MAX_SCORE);
}

/** Validate a level is an integer within the supported range. */
export function normalizeLevel(raw: unknown): number | null {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isInteger(n)) return null;
  if (n < 1 || n > MAX_LEVEL) return null;
  return n;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
}

/**
 * Read the top `TOP_N` entries for a level, highest score first.
 *
 * Upstash returns a flat `[member, score, member, score, …]` array when
 * `withScores` is set; we fold it back into objects.
 */
export async function readLevelBoard(level: number): Promise<LeaderboardEntry[]> {
  const redis = getRedis();
  const flat = (await redis.zrange(levelKey(level), 0, TOP_N - 1, {
    rev: true,
    withScores: true,
  })) as (string | number)[];

  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    const username = String(flat[i]);
    const score = Number(flat[i + 1]);
    if (Number.isFinite(score)) entries.push({ username, score });
  }
  return entries;
}
