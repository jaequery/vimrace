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

// ===========================================================================
// Multiplayer "race rooms"
// ===========================================================================
//
// A room lets several players race the *same* deterministic maze sequence for a
// level at the same time. Because maps are seeded per (level, index) there is no
// geometry to sync — only each player's compact live progress. The whole feature
// rides on plain HTTP request/response against `api/room.ts`; clients poll a
// snapshot and heartbeat their own state. Two keys back a room:
//
//   vimrace:room:{code}          — hash of room metadata (host, level, status…)
//   vimrace:room:{code}:players  — hash of playerId → JSON live state
//
// Both carry a short TTL refreshed on every write, so abandoned rooms clean
// themselves up. Stale players (no heartbeat within the window) are dropped on
// read; the TTL eventually reaps the room entirely.

/** How long an idle room survives before Redis reaps it (seconds). */
export const ROOM_TTL_SECONDS = 30 * 60;
/** A player not seen within this window is treated as gone (ms). */
export const ROOM_PLAYER_STALE_MS = 15_000;
/** Per-room player cap — bounds Redis write volume and keeps the roster legible. */
export const MAX_ROOM_PLAYERS = 8;
/** Length of a generated room code. */
export const ROOM_CODE_LEN = 4;
/** Cap on a stored playerId length. */
export const MAX_PLAYER_ID_LEN = 64;
/**
 * Room-code alphabet — uppercase letters + digits, minus the visually
 * ambiguous `I`, `O`, `0`, `1` so codes are easy to read aloud and type.
 */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type RoomStatus = 'lobby' | 'racing';

/** Server-side room record (the source of truth in Redis). */
export interface RoomRecord {
  code: string;
  /** playerId of the host (the only one allowed to start the race) */
  host: string;
  level: number;
  status: RoomStatus;
  /** epoch ms the race was started, or null while still in the lobby */
  startedAt: number | null;
  createdAt: number;
}

/** One player's live state within a room. */
export interface RoomPlayer {
  playerId: string;
  username: string;
  /** which maze within the level the player is on (0-based) */
  mapIndex: number;
  /** overall level progress, 0..1 */
  progress: number;
  /** true once the player has finished (cleared the level) or busted out */
  finished: boolean;
  /** the player's final level time (ms) if they cleared it, else null */
  finishMs: number | null;
  /** server-stamped epoch ms of the last heartbeat (drives staleness) */
  lastSeen: number;
}

/** Hash key for a room's metadata. */
export function roomKey(code: string): string {
  return `vimrace:room:${code}`;
}

/** Hash key for a room's player states. */
export function roomPlayersKey(code: string): string {
  return `vimrace:room:${code}:players`;
}

/**
 * Validate + normalize a room code: uppercased, must be exactly `ROOM_CODE_LEN`
 * characters drawn from the room alphabet. Returns null if it can't be salvaged.
 */
export function normalizeRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const up = raw.trim().toUpperCase();
  if (up.length !== ROOM_CODE_LEN) return null;
  for (const ch of up) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
  }
  return up;
}

/** Generate a fresh random room code from the unambiguous alphabet. */
export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LEN; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[idx];
  }
  return code;
}

/**
 * Validate a client-supplied playerId: a non-empty string with control
 * characters stripped, capped in length. Returns null if nothing usable remains.
 */
export function normalizePlayerId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let stripped = '';
  for (const ch of raw) {
    if (!isControlChar(ch.codePointAt(0) ?? 0)) stripped += ch;
  }
  const cleaned = stripped.trim().slice(0, MAX_PLAYER_ID_LEN);
  return cleaned.length === 0 ? null : cleaned;
}

/** Clamp a progress value into [0, 1]; non-numbers become 0. */
export function clampProgress(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Normalize a maze index: a non-negative integer, defensively capped. */
export function normalizeMapIndex(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.min(99, Math.max(0, Math.floor(n)));
}

/** Map a server record to the wire shape clients consume (drops createdAt). */
export function roomToWire(room: RoomRecord): Omit<RoomRecord, 'createdAt'> {
  return {
    code: room.code,
    host: room.host,
    level: room.level,
    status: room.status,
    startedAt: room.startedAt,
  };
}

/** Read a room's metadata, or null if it no longer exists. */
export async function readRoom(code: string): Promise<RoomRecord | null> {
  const redis = getRedis();
  const h = (await redis.hgetall(roomKey(code))) as Record<string, unknown> | null;
  if (!h || Object.keys(h).length === 0) return null;
  const host = typeof h.host === 'string' ? h.host : String(h.host ?? '');
  if (!host) return null;
  const level = normalizeLevel(h.level) ?? 1;
  const status: RoomStatus = h.status === 'racing' ? 'racing' : 'lobby';
  const startedRaw = h.startedAt;
  const startedNum =
    startedRaw === null || startedRaw === undefined || startedRaw === ''
      ? null
      : Number(startedRaw);
  const startedAt = typeof startedNum === 'number' && Number.isFinite(startedNum)
    ? startedNum
    : null;
  const createdAt = Number(h.createdAt);
  return {
    code,
    host,
    level,
    status,
    startedAt,
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
  };
}

/** Persist a room's metadata and refresh its TTL. */
export async function writeRoom(room: RoomRecord): Promise<void> {
  const redis = getRedis();
  await redis.hset(roomKey(room.code), {
    host: room.host,
    level: room.level,
    status: room.status,
    startedAt: room.startedAt ?? '',
    createdAt: room.createdAt,
  });
  await touchRoom(room.code);
}

/** Refresh the TTL on both of a room's keys (called on every write). */
export async function touchRoom(code: string): Promise<void> {
  const redis = getRedis();
  await Promise.all([
    redis.expire(roomKey(code), ROOM_TTL_SECONDS),
    redis.expire(roomPlayersKey(code), ROOM_TTL_SECONDS),
  ]);
}

/**
 * Create a brand-new room with a unique code, retrying on the (rare) chance a
 * generated code already exists. Writes the host's room record and returns it.
 */
export async function createUniqueRoom(
  host: string,
  level: number,
  now: number,
): Promise<RoomRecord> {
  const redis = getRedis();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateRoomCode();
    const exists = await redis.exists(roomKey(code));
    if (exists) continue;
    const room: RoomRecord = {
      code,
      host,
      level,
      status: 'lobby',
      startedAt: null,
      createdAt: now,
    };
    await writeRoom(room);
    return room;
  }
  throw new Error('Could not allocate a unique room code');
}

/** Parse one stored player field; tolerates both object and JSON-string values. */
function parsePlayer(playerId: string, raw: unknown): RoomPlayer | null {
  let obj: Record<string, unknown> | null = null;
  if (raw && typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') obj = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (!obj) return null;
  const username = typeof obj.username === 'string' ? obj.username : '';
  const lastSeen = Number(obj.lastSeen);
  if (!username || !Number.isFinite(lastSeen)) return null;
  const finishRaw = obj.finishMs;
  const finishMs =
    typeof finishRaw === 'number' && Number.isFinite(finishRaw) ? finishRaw : null;
  return {
    playerId,
    username,
    mapIndex: normalizeMapIndex(obj.mapIndex),
    progress: clampProgress(obj.progress),
    finished: obj.finished === true,
    finishMs,
    lastSeen,
  };
}

/**
 * Upsert one player's live state (last-write-wins) and refresh the room TTL.
 * `lastSeen` is stamped here, server-side, so staleness can't be spoofed.
 */
export async function upsertPlayer(
  code: string,
  player: Omit<RoomPlayer, 'lastSeen'>,
  now: number,
): Promise<void> {
  const redis = getRedis();
  const record: RoomPlayer = { ...player, lastSeen: now };
  await redis.hset(roomPlayersKey(code), {
    [player.playerId]: JSON.stringify(record),
  });
  await touchRoom(code);
}

/**
 * Read every live player in a room, dropping any whose last heartbeat is older
 * than `ROOM_PLAYER_STALE_MS` (they've disconnected). Sorted for a stable roster:
 * finishers first by time, then the rest by progress (furthest along first).
 */
export async function readPlayers(code: string, now: number): Promise<RoomPlayer[]> {
  const redis = getRedis();
  const h = (await redis.hgetall(roomPlayersKey(code))) as Record<string, unknown> | null;
  if (!h) return [];
  const players: RoomPlayer[] = [];
  for (const [playerId, raw] of Object.entries(h)) {
    const p = parsePlayer(playerId, raw);
    if (p && now - p.lastSeen <= ROOM_PLAYER_STALE_MS) players.push(p);
  }
  return sortPlayers(players);
}

/** Standings order: finishers (fastest first) above everyone still racing. */
export function sortPlayers(players: RoomPlayer[]): RoomPlayer[] {
  return [...players].sort((a, b) => {
    const aDone = a.finished && a.finishMs !== null;
    const bDone = b.finished && b.finishMs !== null;
    if (aDone && bDone) return (a.finishMs as number) - (b.finishMs as number);
    if (aDone !== bDone) return aDone ? -1 : 1;
    // Neither has a recorded finish time → furthest progress ranks higher.
    return b.progress - a.progress;
  });
}
