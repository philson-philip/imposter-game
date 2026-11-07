import {
  RoomError,
  applyAction,
  createRoom,
  finalize,
  joinRoom,
  makeCode,
  toView,
  touch,
} from "@/lib/room-logic";
import type { Room, RoomAction, RoomPlayer, RoomView } from "@/lib/room-types";
import { getStore } from "./store";

/** Short-lived per-instance cache so a burst of polls costs one Redis read. */
const CACHE_MS = 900;
const cache = new Map<string, { room: Room; at: number }>();

function remember(room: Room): Room {
  cache.set(room.code, { room, at: Date.now() });
  return room;
}

export async function readRoom(code: string, fresh = false): Promise<Room | null> {
  const hit = cache.get(code);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.room;
  const room = await getStore().get(code);
  if (room) remember(room);
  else cache.delete(code);
  return room;
}

export async function createNewRoom(hostName: string): Promise<{ room: Room; player: RoomPlayer }> {
  const store = getStore();
  for (let attempt = 0; attempt < 6; attempt++) {
    const { room, player } = createRoom(makeCode(), hostName, Date.now());
    if (await store.create(room)) return { room: remember(room), player };
  }
  throw new RoomError(503, "Couldn't find a free room code. Try again.");
}

/**
 * Reads the room, applies `fn`, and writes back with compare-and-set.
 * Retries when another request changed the room in between.
 */
export async function mutateRoom(code: string, fn: (room: Room) => Room): Promise<Room> {
  const store = getStore();
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await store.get(code);
    if (!current) {
      cache.delete(code);
      throw new RoomError(404, "That room doesn't exist (or it expired).");
    }
    const next = fn(current);
    if (next === current) return remember(current);
    const written: Room = { ...next, rev: current.rev + 1 };
    if (written.players.length === 0) {
      await store.delete(code);
      cache.delete(code);
      return written;
    }
    if (await store.update(written, current.rev)) return remember(written);
  }
  throw new RoomError(409, "The room is busy right now. Try again.");
}

export async function joinExistingRoom(code: string, name: string): Promise<{ room: Room; player: RoomPlayer }> {
  let player: RoomPlayer | null = null;
  const room = await mutateRoom(code, (current) => {
    const res = joinRoom(current, name, Date.now());
    player = res.player;
    return res.room;
  });
  if (!player) throw new RoomError(500, "Join failed.");
  return { room, player };
}

export async function performAction(code: string, playerId: string, action: RoomAction): Promise<Room> {
  return mutateRoom(code, (current) => finalize(applyAction(current, playerId, action, Date.now())));
}

/** Best-effort presence update; a lost race just means we try again on the next poll. */
export async function recordPresence(room: Room, playerId: string): Promise<Room> {
  const touched = touch(room, playerId, Date.now());
  if (!touched) return room;
  const written: Room = { ...touched, rev: room.rev + 1 };
  const ok = await getStore().update(written, room.rev);
  return ok ? remember(written) : room;
}

export function authenticate(room: Room, playerId: string | null, token: string | null): RoomPlayer {
  const player = playerId ? room.players.find((p) => p.id === playerId) : undefined;
  if (!player || !token || player.token !== token) throw new RoomError(403, "You're not in this room any more.");
  return player;
}

export function viewFor(room: Room, playerId: string): RoomView {
  return toView(room, playerId, Date.now());
}
