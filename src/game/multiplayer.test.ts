/**
 * multiplayer.ts — the room API client + helpers. Covers the failure-tolerant
 * contract (network errors / non-2xx degrade to null/false, never throw), the
 * response normalizers, the per-tab player id, and the progress estimator.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeLevelProgress,
  getOrCreatePlayerId,
  roomCreate,
  roomJoin,
  roomStart,
  roomPublishState,
  fetchRoomSnapshot,
} from '@/game/multiplayer';
import type { GameMap } from '@/game/types';

/** Build a fake fetch Response with a JSON body. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const sampleRoom = {
  code: 'ABCD',
  host: 'host-1',
  level: 3,
  status: 'lobby',
  startedAt: null,
};

const samplePlayer = {
  playerId: 'host-1',
  username: 'Ada',
  mapIndex: 1,
  progress: 0.5,
  finished: false,
  finishMs: null,
};

describe('multiplayer client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('roomCreate', () => {
    it('returns the code + room on success', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true, code: 'ABCD', room: sampleRoom }))),
      );
      const result = await roomCreate('host-1', 'Ada', 3);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('ABCD');
      expect(result?.room.level).toBe(3);
      expect(result?.room.status).toBe('lobby');
    });

    it('resolves null on a network error', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
      expect(await roomCreate('host-1', 'Ada', 1)).toBeNull();
    });

    it('resolves null when the server omits a code', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true }))));
      expect(await roomCreate('host-1', 'Ada', 1)).toBeNull();
    });
  });

  describe('roomJoin', () => {
    it('returns ok with the room on success', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true, code: 'ABCD', room: sampleRoom }))),
      );
      const result = await roomJoin('ABCD', 'p-2', 'Bob');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.room.code).toBe('ABCD');
    });

    it('maps 404 to a "not found" message', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(404, { error: 'Room not found' }))));
      const result = await roomJoin('ZZZZ', 'p-2', 'Bob');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/no room/i);
    });

    it('maps 403 to the server-supplied "full" message', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(403, { error: 'Room is full' }))));
      const result = await roomJoin('ABCD', 'p-2', 'Bob');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/full/i);
    });

    it('degrades to a generic error on a network failure', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
      const result = await roomJoin('ABCD', 'p-2', 'Bob');
      expect(result.ok).toBe(false);
    });
  });

  describe('roomStart / roomPublishState', () => {
    it('roomStart resolves true on a 2xx and false otherwise', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true }))));
      expect(await roomStart('ABCD', 'host-1')).toBe(true);
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(403, { error: 'nope' }))));
      expect(await roomStart('ABCD', 'p-2')).toBe(false);
    });

    it('roomPublishState resolves false on a network error', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
      const ok = await roomPublishState('ABCD', 'host-1', 'Ada', {
        mapIndex: 0,
        progress: 0,
        finished: false,
        finishMs: null,
      });
      expect(ok).toBe(false);
    });
  });

  describe('fetchRoomSnapshot', () => {
    it('returns the normalized snapshot and filters invalid players', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve(
            jsonResponse(200, {
              room: sampleRoom,
              players: [samplePlayer, { username: 'no-id' }, null, 42],
            }),
          ),
        ),
      );
      const snap = await fetchRoomSnapshot('ABCD');
      expect(snap).not.toBeNull();
      expect(snap?.room.code).toBe('ABCD');
      // Only the well-formed player survives normalization.
      expect(snap?.players).toHaveLength(1);
      expect(snap?.players[0].username).toBe('Ada');
    });

    it('returns null on a 404 (room gone)', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(404, { error: 'gone' }))));
      expect(await fetchRoomSnapshot('ZZZZ')).toBeNull();
    });

    it('returns null on a network error', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
      expect(await fetchRoomSnapshot('ABCD')).toBeNull();
    });
  });
});

describe('getOrCreatePlayerId', () => {
  beforeEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });

  it('returns a stable id across calls', () => {
    const a = getOrCreatePlayerId();
    const b = getOrCreatePlayerId();
    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });
});

describe('computeLevelProgress', () => {
  const map: GameMap = {
    rows: 1,
    cols: 5,
    grid: [[false, false, false, false, false]],
    start: { row: 0, col: 0 },
    goal: { row: 0, col: 4 },
    level: 1,
    seed: 1,
    par: 4,
  };

  it('is 0 at the start of the first maze', () => {
    expect(computeLevelProgress(map, { row: 0, col: 0 }, 0, 3)).toBeCloseTo(0, 5);
  });

  it('reaches the per-maze fraction at the goal', () => {
    // At the goal of maze 0 of 3: (0 + 1) / 3.
    expect(computeLevelProgress(map, { row: 0, col: 4 }, 0, 3)).toBeCloseTo(1 / 3, 5);
  });

  it('is 1 at the goal of the final maze', () => {
    expect(computeLevelProgress(map, { row: 0, col: 4 }, 2, 3)).toBeCloseTo(1, 5);
  });

  it('rises monotonically as the cursor nears the goal', () => {
    const near = computeLevelProgress(map, { row: 0, col: 3 }, 0, 3);
    const far = computeLevelProgress(map, { row: 0, col: 1 }, 0, 3);
    expect(near).toBeGreaterThan(far);
  });
});
