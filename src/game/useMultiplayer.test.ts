/**
 * useMultiplayer.ts — the room connection/sync hook. The underlying API client
 * is mocked so this suite exercises the hook's state machine (create / join /
 * leave, host detection, the poll loop populating the roster) in isolation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/game/multiplayer', () => ({
  getOrCreatePlayerId: vi.fn(() => 'me'),
  roomCreate: vi.fn(),
  roomJoin: vi.fn(),
  roomStart: vi.fn(() => Promise.resolve(true)),
  roomPublishState: vi.fn(() => Promise.resolve(true)),
  fetchRoomSnapshot: vi.fn(() => Promise.resolve(null)),
}));

import { useMultiplayer } from '@/game/useMultiplayer';
import * as mpClient from '@/game/multiplayer';
import type { RoomInfo, PlayerState } from '@/game/multiplayer';

const room: RoomInfo = {
  code: 'ABCD',
  host: 'me',
  level: 2,
  status: 'lobby',
  startedAt: null,
};

const roster: PlayerState[] = [
  { playerId: 'me', username: 'Me', mapIndex: 0, progress: 0, finished: false, finishMs: null },
  { playerId: 'p2', username: 'You', mapIndex: 0, progress: 0, finished: false, finishMs: null },
];

describe('useMultiplayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Keep the room alive across poll ticks for create/join tests.
    vi.mocked(mpClient.fetchRoomSnapshot).mockResolvedValue({ room, players: roster });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with no room', () => {
    const { result, unmount } = renderHook(() => useMultiplayer());
    expect(result.current.room).toBeNull();
    expect(result.current.players).toEqual([]);
    expect(result.current.isHost).toBe(false);
    expect(result.current.playerId).toBe('me');
    unmount();
  });

  it('create() enters a room and marks us host', async () => {
    vi.mocked(mpClient.roomCreate).mockResolvedValue({ code: 'ABCD', room });
    const { result, unmount } = renderHook(() => useMultiplayer());

    await act(async () => {
      const ok = await result.current.create('Me', 2);
      expect(ok).toBe(true);
    });

    expect(result.current.room?.code).toBe('ABCD');
    expect(result.current.isHost).toBe(true);

    // The poll loop pulls the roster in.
    await waitFor(() => expect(result.current.players.length).toBe(2));
    unmount();
  });

  it('create() surfaces an error when the backend is unreachable', async () => {
    vi.mocked(mpClient.roomCreate).mockResolvedValue(null);
    const { result, unmount } = renderHook(() => useMultiplayer());

    await act(async () => {
      const ok = await result.current.create('Me', 2);
      expect(ok).toBe(false);
    });

    expect(result.current.room).toBeNull();
    expect(result.current.error).toBeTruthy();
    unmount();
  });

  it('join() failure sets the error and stays out of the room', async () => {
    vi.mocked(mpClient.roomJoin).mockResolvedValue({ ok: false, error: 'No room with that code.' });
    const { result, unmount } = renderHook(() => useMultiplayer());

    await act(async () => {
      const ok = await result.current.join('ZZZZ', 'Me');
      expect(ok).toBe(false);
    });

    expect(result.current.room).toBeNull();
    expect(result.current.error).toMatch(/no room/i);
    unmount();
  });

  it('leave() drops out of the room', async () => {
    vi.mocked(mpClient.roomCreate).mockResolvedValue({ code: 'ABCD', room });
    const { result, unmount } = renderHook(() => useMultiplayer());

    await act(async () => {
      await result.current.create('Me', 2);
    });
    expect(result.current.room).not.toBeNull();

    act(() => {
      result.current.leave();
    });
    expect(result.current.room).toBeNull();
    expect(result.current.players).toEqual([]);
    unmount();
  });
});
