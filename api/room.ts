/**
 * VimRace multiplayer "race room" endpoint — a single multiplexed handler.
 *
 * Because every VimRace maze is deterministic per (level, index), players in a
 * room never need to sync map geometry — only their compact live progress. The
 * connection model is plain HTTP: clients poll `GET ?code=XXXX` for a snapshot
 * and POST their own state as a heartbeat. No WebSocket server required, so this
 * runs unchanged on Vercel serverless alongside the leaderboard functions.
 *
 * Actions (POST body `{ action, ... }`):
 *   create {playerId, username, level}  → { ok, code, room }   create + host
 *   join   {code, playerId, username}   → { ok, code, room }   404 if gone, 403 if full
 *   state  {code, playerId, username, mapIndex, progress, finished, finishMs}
 *                                       → { ok }                upsert + heartbeat
 *   start  {code, playerId}             → { ok, room }          host-only; begin race
 *
 * Snapshot (GET `?code=XXXX`)           → { room, players }     404 if room gone
 *
 * Authority stays client-side — identical to the existing leaderboard's trust
 * model. Times are not refereed here; the official per-level board still flows
 * through `/api/score`.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  MAX_ROOM_PLAYERS,
  createUniqueRoom,
  normalizeLevel,
  normalizePlayerId,
  normalizeRoomCode,
  normalizeMapIndex,
  normalizeTimeMs,
  normalizeUsername,
  clampProgress,
  readPlayers,
  readRoom,
  roomToWire,
  upsertPlayer,
  writeRoom,
} from './_redis';
import type { RoomPlayer } from './_redis';

/** Drop the internal `lastSeen` cursor before sending a player over the wire. */
function playerToWire(p: RoomPlayer): Omit<RoomPlayer, 'lastSeen'> {
  return {
    playerId: p.playerId,
    username: p.username,
    mapIndex: p.mapIndex,
    progress: p.progress,
    finished: p.finished,
    finishMs: p.finishMs,
  };
}

async function handleGet(req: VercelRequest, res: VercelResponse): Promise<void> {
  const code = normalizeRoomCode(
    Array.isArray(req.query.code) ? req.query.code[0] : req.query.code,
  );
  if (!code) {
    res.status(400).json({ error: 'Invalid room code' });
    return;
  }
  const now = Date.now();
  const room = await readRoom(code);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const players = await readPlayers(code, now);
  // Realtime data — never let an edge cache serve a stale roster.
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ room: roomToWire(room), players: players.map(playerToWire) });
}

async function handlePost(req: VercelRequest, res: VercelResponse): Promise<void> {
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

  const fields = body as Record<string, unknown>;
  const action = fields.action;
  const now = Date.now();

  if (action === 'create') {
    const username = normalizeUsername(fields.username);
    const playerId = normalizePlayerId(fields.playerId);
    if (!username || !playerId) {
      res.status(400).json({ error: 'Invalid username or playerId' });
      return;
    }
    const level = normalizeLevel(fields.level) ?? 1;
    const room = await createUniqueRoom(playerId, level, now);
    await upsertPlayer(
      room.code,
      { playerId, username, mapIndex: 0, progress: 0, finished: false, finishMs: null },
      now,
    );
    res.status(200).json({ ok: true, code: room.code, room: roomToWire(room) });
    return;
  }

  if (action === 'join') {
    const code = normalizeRoomCode(fields.code);
    const username = normalizeUsername(fields.username);
    const playerId = normalizePlayerId(fields.playerId);
    if (!code) {
      res.status(400).json({ error: 'Invalid room code' });
      return;
    }
    if (!username || !playerId) {
      res.status(400).json({ error: 'Invalid username or playerId' });
      return;
    }
    const room = await readRoom(code);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const players = await readPlayers(code, now);
    const already = players.some((p) => p.playerId === playerId);
    if (!already && players.length >= MAX_ROOM_PLAYERS) {
      res.status(403).json({ error: 'Room is full' });
      return;
    }
    await upsertPlayer(
      code,
      { playerId, username, mapIndex: 0, progress: 0, finished: false, finishMs: null },
      now,
    );
    res.status(200).json({ ok: true, code, room: roomToWire(room) });
    return;
  }

  if (action === 'state') {
    const code = normalizeRoomCode(fields.code);
    const username = normalizeUsername(fields.username);
    const playerId = normalizePlayerId(fields.playerId);
    if (!code || !username || !playerId) {
      res.status(400).json({ error: 'Invalid room state payload' });
      return;
    }
    const room = await readRoom(code);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const finished = fields.finished === true;
    // finishMs is only meaningful for a player who cleared the level.
    const finishMs = finished ? normalizeTimeMs(fields.finishMs) : null;
    await upsertPlayer(
      code,
      {
        playerId,
        username,
        mapIndex: normalizeMapIndex(fields.mapIndex),
        progress: clampProgress(fields.progress),
        finished,
        finishMs,
      },
      now,
    );
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'start') {
    const code = normalizeRoomCode(fields.code);
    const playerId = normalizePlayerId(fields.playerId);
    if (!code || !playerId) {
      res.status(400).json({ error: 'Invalid start payload' });
      return;
    }
    const room = await readRoom(code);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if (room.host !== playerId) {
      res.status(403).json({ error: 'Only the host can start the race' });
      return;
    }
    const started = { ...room, status: 'racing' as const, startedAt: now };
    await writeRoom(started);
    res.status(200).json({ ok: true, room: roomToWire(started) });
    return;
  }

  res.status(400).json({ error: 'Unknown action' });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    if (req.method === 'GET') {
      await handleGet(req, res);
      return;
    }
    if (req.method === 'POST') {
      await handlePost(req, res);
      return;
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/room] redis error', err);
    res.status(502).json({ error: 'Room storage unavailable' });
  }
}
