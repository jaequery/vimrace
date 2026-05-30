import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchRoomSnapshot,
  getOrCreatePlayerId,
  roomCreate,
  roomJoin,
  roomPublishState,
  roomStart,
} from '@/game/multiplayer';
import type { LocalPlayerState, PlayerState, RoomInfo } from '@/game/multiplayer';

/**
 * How often (ms) a client in a room heartbeats its own state and pulls a fresh
 * snapshot. ~800 ms gives an arcade-acceptable "ghost" feel for opponents while
 * bounding Redis op volume to a couple of round-trips per player per tick.
 */
export const ROOM_POLL_MS = 800;

/** The default state a player publishes before they've started moving. */
const INITIAL_LOCAL_STATE: LocalPlayerState = {
  mapIndex: 0,
  progress: 0,
  finished: false,
  finishMs: null,
};

export interface UseMultiplayerReturn {
  /** this tab's stable player id */
  playerId: string;
  /** the room we're currently in, or null if not in one */
  room: RoomInfo | null;
  /** live roster from the latest snapshot (includes ourselves) */
  players: PlayerState[];
  /** true when we are the room's host */
  isHost: boolean;
  /** a create/join request is in flight */
  pending: boolean;
  /** last user-facing error (e.g. a failed join), or null */
  error: string | null;
  /** create a room and become its host; resolves true on success */
  create: (username: string, level: number) => Promise<boolean>;
  /** join a room by code; resolves true on success (sets `error` on failure) */
  join: (code: string, username: string) => Promise<boolean>;
  /** host-only: start the race for everyone in the room */
  start: () => Promise<void>;
  /** leave the current room (local only — staleness reaps us server-side) */
  leave: () => void;
  /** update the state this client publishes each heartbeat (no network) */
  setLocalState: (state: LocalPlayerState) => void;
  /** force an immediate heartbeat (e.g. on finishing, so standings update fast) */
  flush: () => void;
}

/**
 * Connection + sync hook for multiplayer race rooms. Owns a stable per-tab
 * playerId, a poll loop that heartbeats our own state and pulls the roster while
 * we're in a room, and the create/join/start/leave actions. Fully decoupled from
 * `useGame`: the app bridges local race progress in via `setLocalState`.
 */
export function useMultiplayer(): UseMultiplayerReturn {
  // Stable for the lifetime of the component (one per tab).
  const playerIdRef = useRef<string>('');
  if (!playerIdRef.current) playerIdRef.current = getOrCreatePlayerId();
  const playerId = playerIdRef.current;

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs the poll loop reads without re-subscribing each render.
  const codeRef = useRef<string | null>(null);
  const usernameRef = useRef<string>('');
  const localStateRef = useRef<LocalPlayerState>({ ...INITIAL_LOCAL_STATE });

  const inRoom = room !== null;

  // -------------------------------------------------------------------------
  // Poll loop — runs only while we're in a room. Each tick heartbeats our own
  // state (keeps us on the roster + pushes progress) then pulls a snapshot. A
  // null snapshot means the room is gone (expired / unreachable) → we drop out.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!inRoom) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick(): Promise<void> {
      const code = codeRef.current;
      if (!code || cancelled) return;
      await roomPublishState(code, playerId, usernameRef.current, localStateRef.current);
      const snapshot = await fetchRoomSnapshot(code);
      if (cancelled) return;
      if (snapshot === null) {
        codeRef.current = null;
        setRoom(null);
        setPlayers([]);
        return;
      }
      setRoom(snapshot.room);
      setPlayers(snapshot.players);
      timer = setTimeout(() => void tick(), ROOM_POLL_MS);
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [inRoom, playerId]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const create = useCallback(
    async (username: string, level: number): Promise<boolean> => {
      setPending(true);
      setError(null);
      usernameRef.current = username;
      localStateRef.current = { ...INITIAL_LOCAL_STATE };
      const result = await roomCreate(playerId, username, level);
      setPending(false);
      if (!result) {
        setError('Could not create a room. The room service may be offline.');
        return false;
      }
      codeRef.current = result.code;
      setRoom(result.room);
      setPlayers([]);
      return true;
    },
    [playerId],
  );

  const join = useCallback(
    async (code: string, username: string): Promise<boolean> => {
      setPending(true);
      setError(null);
      usernameRef.current = username;
      localStateRef.current = { ...INITIAL_LOCAL_STATE };
      const result = await roomJoin(code, playerId, username);
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      codeRef.current = result.code;
      setRoom(result.room);
      setPlayers([]);
      return true;
    },
    [playerId],
  );

  const start = useCallback(async (): Promise<void> => {
    const code = codeRef.current;
    if (!code) return;
    await roomStart(code, playerId);
    // The next poll reflects the racing status for everyone, including us.
  }, [playerId]);

  const leave = useCallback((): void => {
    codeRef.current = null;
    localStateRef.current = { ...INITIAL_LOCAL_STATE };
    setRoom(null);
    setPlayers([]);
    setError(null);
  }, []);

  const setLocalState = useCallback((state: LocalPlayerState): void => {
    localStateRef.current = state;
  }, []);

  const flush = useCallback((): void => {
    const code = codeRef.current;
    if (code) {
      void roomPublishState(code, playerId, usernameRef.current, localStateRef.current);
    }
  }, [playerId]);

  return {
    playerId,
    room,
    players,
    isHost: room !== null && room.host === playerId,
    pending,
    error,
    create,
    join,
    start,
    leave,
    setLocalState,
    flush,
  };
}
