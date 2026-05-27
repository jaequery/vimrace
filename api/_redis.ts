/**
 * Shared Upstash Redis client + leaderboard helpers for VimRace serverless functions.
 *
 * The REST credentials come from the Vercel ↔ Upstash integration, which injects
 * `KV_REST_API_URL` / `KV_REST_API_TOKEN` (the legacy Vercel KV names). We read
 * those explicitly rather than `Redis.fromEnv()` (which expects the
 * `UPSTASH_REDIS_REST_*` names).
 *
 * Data model — two flavours of sorted set:
 *
 *   per-level *time* board   key: vimrace:lb:lvl:{level}
 *     member: username   score: best completion time (ms) at that level
 *     ranked fastest-first (ZRANGE ascending). Writes use `LT` so a player's
 *     entry only ever moves *down* (faster), never up.
 *
 *   overall *score* board    key: vimrace:lb:overall
 *     member: username   score: best run score
 *     ranked highest-first (ZRANGE … REV). Writes use `GT` so a player's entry
 *     only ever moves *up*.
 */
import { Redis } from '@upstash/redis';

export const MAX_LEVEL = 20;
export const TOP_N = 10;
export const MAX_USERNAME_LEN = 16;
/** Defensive ceiling — far above any realistic single-run score. */
export const MAX_SCORE = 100_000_000;
/** Defensive ceiling for a level time (ms): nobody legitimately takes >10 min. */
export const MAX_TIME_MS = 600_000;

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

/** Sorted-set key for a level's time board. */
export function levelKey(level: number): string {
  return `vimrace:lb:lvl:${level}`;
}

/** Sorted-set key for the overall score board. */
export function overallKey(): string {
  return 'vimrace:lb:overall';
}

/** True for ASCII control characters: C0 range (0x00–0x1F) and DEL (0x7F). */
function isControlChar(code: number): boolean {
  return code <= 0x1f || code === 0x7f;
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
  let stripped = '';
  for (const ch of raw) {
    if (!isControlChar(ch.codePointAt(0) ?? 0)) stripped += ch;
  }
  const cleaned = stripped.replace(/\s+/g, ' ').trim().slice(0, MAX_USERNAME_LEN);
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

/** Validate + clamp a level time (ms); returns null if unusable. Must be > 0. */
export function normalizeTimeMs(raw: unknown): number | null {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const floored = Math.floor(n);
  if (floored <= 0) return null;
  return Math.min(floored, MAX_TIME_MS);
}

/** Validate a level is an integer within the supported range. */
export function normalizeLevel(raw: unknown): number | null {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isInteger(n)) return null;
  if (n < 1 || n > MAX_LEVEL) return null;
  return n;
}

export interface TimeEntry {
  username: string;
  timeMs: number;
}

export interface ScoreEntry {
  username: string;
  score: number;
}

/**
 * Read the top `TOP_N` entries for a level's time board, fastest first.
 *
 * Upstash returns a flat `[member, score, member, score, …]` array when
 * `withScores` is set; we fold it back into objects.
 */
export async function readLevelBoard(level: number): Promise<TimeEntry[]> {
  const redis = getRedis();
  // Ascending by score (= time): lowest time ranks first.
  const flat = (await redis.zrange(levelKey(level), 0, TOP_N - 1, {
    withScores: true,
  })) as (string | number)[];

  const entries: TimeEntry[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    const username = String(flat[i]);
    const timeMs = Number(flat[i + 1]);
    if (Number.isFinite(timeMs)) entries.push({ username, timeMs });
  }
  return entries;
}

/**
 * Rank a completion time on a level board: how many recorded times are strictly
 * faster, plus one (1-based). Computed from the caller's own time via `ZCOUNT`
 * rather than from a member lookup, so it is correct even if the player's run
 * hasn't been written yet (no submit/fetch race) and reaches beyond `TOP_N`.
 * Returns null for an unusable time.
 */
export async function rankByTime(level: number, rawTime: unknown): Promise<number | null> {
  const timeMs = normalizeTimeMs(rawTime);
  if (timeMs === null) return null;
  const redis = getRedis();
  // Exclusive upper bound `(timeMs`: count entries strictly faster than ours.
  const faster = (await redis.zcount(levelKey(level), '-inf', `(${timeMs}`)) as number;
  return Number(faster) + 1;
}

/** Read the top `TOP_N` entries for the overall score board, highest first. */
export async function readOverallBoard(): Promise<ScoreEntry[]> {
  const redis = getRedis();
  const flat = (await redis.zrange(overallKey(), 0, TOP_N - 1, {
    rev: true,
    withScores: true,
  })) as (string | number)[];

  const entries: ScoreEntry[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    const username = String(flat[i]);
    const score = Number(flat[i + 1]);
    if (Number.isFinite(score)) entries.push({ username, score });
  }
  return entries;
}
