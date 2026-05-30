/**
 * Client for the VimRace multiplayer "race room" API (`/api/room`).
 *
 * A room lets several players race the *same* deterministic maze sequence at the
 * same time. Maps never travel over the wire — they're seeded per (level, index)
 * so everyone already shares identical layouts. Only each player's compact live
 * progress is exchanged: clients POST their own state as a heartbeat and GET a
 * snapshot of everyone's, on a poll loop. No sockets, no new infrastructure.
 *
 * Like `leaderboard.ts`, every call here is failure-tolerant: the room backend
 * is optional, so a network error or non-2xx degrades to null/false instead of
 * throwing. Single-player must stay fully playable with rooms offline.
 */

import type { GameMap, Pos } from '@/game/types';

const ROOM_ENDPOINT = '/api/room';

/** sessionStorage key for this tab's stable player identity. */
const PLAYER_ID_KEY = 'vimrace.playerId';

/** Lifecycle of a room: gathering players, or actively racing. */
export type RoomStatus = 'lobby' | 'racing';

/** Room metadata as the client sees it (the server's record minus `createdAt`). */
export interface RoomInfo {
  code: string;
  /** playerId of the host — only they may start the race */
  host: string;
  level: number;
  status: RoomStatus;
  /** epoch ms the race started, or null while still in the lobby */
  startedAt: number | null;
}

/** One player's live race state within a room. */
export interface PlayerState {
  playerId: string;
  username: string;
  /** which maze within the level the player is on (0-based) */
  mapIndex: number;
  /** overall level progress, 0..1 */
  progress: number;
  /** true once the player cleared the level or busted out of time */
  finished: boolean;
  /** the player's final level time (ms) if they cleared it, else null */
  finishMs: number | null;
}

/** The fields a player publishes about themselves each heartbeat. */
export interface LocalPlayerState {
  mapIndex: number;
  progress: number;
  finished: boolean;
  finishMs: number | null;
}

/** A full room snapshot: metadata + every live player. */
export interface RoomSnapshot {
  room: RoomInfo;
  players: PlayerState[];
}

/**
 * The slice of multiplayer state the game screens need while racing in a room.
 * Assembled by `App` from `useMultiplayer` and passed down; `null` means
 * single-player. Keeps the screens decoupled from the full hook surface.
 */
export interface MultiplayerView {
  room: RoomInfo;
  players: PlayerState[];
  playerId: string;
  isHost: boolean;
  /** leave the room and return to the single-player start screen */
  leave: () => void;
}

// ---------------------------------------------------------------------------
// Player identity — one stable id per browser tab
// ---------------------------------------------------------------------------

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the manual id
  }
  return `p-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

/**
 * Get (or lazily create) this tab's player id. Persisted to sessionStorage so a
 * refresh keeps the same identity, but two tabs get distinct ids — letting one
 * person open several windows to test or play casually. Storage-safe.
 */
export function getOrCreatePlayerId(): string {
  try {
    const existing = sessionStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    const id = randomId();
    sessionStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

// ---------------------------------------------------------------------------
// Progress estimation — a cheap 0..1 "how far through the level" measure
// ---------------------------------------------------------------------------

function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/**
 * Estimate overall level progress (0..1) from the live cursor. Within a maze we
 * use the cursor's Manhattan closeness to the goal (start = 0, goal = 1); across
 * the level we weight that by which maze the player is on. It's an approximation
 * — good enough to drive a lively opponent progress bar without sharing any map
 * geometry — and is monotonic-ish as the player advances.
 */
export function computeLevelProgress(
  map: GameMap,
  cursor: Pos,
  mapIndex: number,
  mapsPerLevel: number,
): number {
  const total = Math.max(1, mapsPerLevel);
  const span = manhattan(map.start, map.goal);
  const within = span > 0 ? 1 - manhattan(cursor, map.goal) / span : 1;
  const clampedWithin = Math.min(1, Math.max(0, within));
  return Math.min(1, Math.max(0, (mapIndex + clampedWithin) / total));
}

// ---------------------------------------------------------------------------
// Wire normalizers — never trust a response shape
// ---------------------------------------------------------------------------

function normalizeRoomInfo(raw: unknown): RoomInfo | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const code = typeof o.code === 'string' ? o.code : null;
  const host = typeof o.host === 'string' ? o.host : null;
  if (!code || !host) return null;
  const level = typeof o.level === 'number' && Number.isFinite(o.level) ? o.level : 1;
  const status: RoomStatus = o.status === 'racing' ? 'racing' : 'lobby';
  const startedAt =
    typeof o.startedAt === 'number' && Number.isFinite(o.startedAt) ? o.startedAt : null;
  return { code, host, level, status, startedAt };
}

function normalizePlayerState(raw: unknown): PlayerState | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const playerId = typeof o.playerId === 'string' ? o.playerId : null;
  const username = typeof o.username === 'string' ? o.username : null;
  if (!playerId || !username) return null;
  const mapIndex =
    typeof o.mapIndex === 'number' && Number.isFinite(o.mapIndex) ? o.mapIndex : 0;
  const progress =
    typeof o.progress === 'number' && Number.isFinite(o.progress)
      ? Math.min(1, Math.max(0, o.progress))
      : 0;
  const finished = o.finished === true;
  const finishMs =
    typeof o.finishMs === 'number' && Number.isFinite(o.finishMs) ? o.finishMs : null;
  return { playerId, username, mapIndex, progress, finished, finishMs };
}

// ---------------------------------------------------------------------------
// API calls — all failure-tolerant
// ---------------------------------------------------------------------------

interface PostResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
}

async function postAction(
  action: string,
  payload: Record<string, unknown>,
): Promise<PostResult> {
  try {
    const res = await fetch(ROOM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    let data: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = await res.json();
      if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/** Create a new room. Resolves to the code + room on success, else null. */
export async function roomCreate(
  playerId: string,
  username: string,
  level: number,
): Promise<{ code: string; room: RoomInfo } | null> {
  const r = await postAction('create', { playerId, username, level });
  const code = typeof r.data?.code === 'string' ? r.data.code : null;
  if (!r.ok || !code) return null;
  const room =
    normalizeRoomInfo(r.data?.room) ??
    ({ code, host: playerId, level, status: 'lobby', startedAt: null } as RoomInfo);
  return { code, room };
}

/** Result of attempting to join a room — a typed success or a reason string. */
export type JoinResult =
  | { ok: true; code: string; room: RoomInfo }
  | { ok: false; error: string };

/** Join an existing room by code. Distinguishes "not found" / "full" for the UI. */
export async function roomJoin(
  code: string,
  playerId: string,
  username: string,
): Promise<JoinResult> {
  const r = await postAction('join', { code, playerId, username });
  const room = normalizeRoomInfo(r.data?.room);
  if (r.ok && room) {
    const resolved = typeof r.data?.code === 'string' ? r.data.code : code;
    return { ok: true, code: resolved, room };
  }
  if (r.status === 404) return { ok: false, error: 'No room with that code.' };
  if (r.status === 403) {
    const msg = typeof r.data?.error === 'string' ? r.data.error : 'Room is full.';
    return { ok: false, error: msg };
  }
  return { ok: false, error: 'Could not join room.' };
}

/** Publish this player's live state (heartbeat). Resolves true on a 2xx. */
export async function roomPublishState(
  code: string,
  playerId: string,
  username: string,
  state: LocalPlayerState,
): Promise<boolean> {
  const r = await postAction('state', { code, playerId, username, ...state });
  return r.ok;
}

/** Host-only: flip the room to racing. Resolves true on success. */
export async function roomStart(code: string, playerId: string): Promise<boolean> {
  const r = await postAction('start', { code, playerId });
  return r.ok;
}

/**
 * Fetch a room snapshot. Resolves to null if the room is gone (404) or the
 * request fails — the caller treats null as "room ended / unreachable".
 */
export async function fetchRoomSnapshot(code: string): Promise<RoomSnapshot | null> {
  try {
    const res = await fetch(`${ROOM_ENDPOINT}?code=${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (data === null || typeof data !== 'object') return null;
    const obj = data as { room?: unknown; players?: unknown };
    const room = normalizeRoomInfo(obj.room);
    if (!room) return null;
    const players = Array.isArray(obj.players)
      ? obj.players
          .map(normalizePlayerState)
          .filter((p): p is PlayerState => p !== null)
      : [];
    return { room, players };
  } catch {
    return null;
  }
}
