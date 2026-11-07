import { Redis } from "@upstash/redis";
import { ROOM } from "@/lib/room-logic";
import type { Room } from "@/lib/room-types";

export interface RoomStore {
  get(code: string): Promise<Room | null>;
  /** Writes only when no room with this code exists. */
  create(room: Room): Promise<boolean>;
  /** Compare-and-set: succeeds only if the stored room is still at `expectedRev`. */
  update(room: Room, expectedRev: number): Promise<boolean>;
  delete(code: string): Promise<void>;
}

const key = (code: string) => `room:${code}`;

const CAS_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
if not cur then return 0 end
local ok, obj = pcall(cjson.decode, cur)
if not ok or tostring(obj.rev) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

class RedisStore implements RoomStore {
  constructor(private redis: Redis) {}

  async get(code: string): Promise<Room | null> {
    const raw = await this.redis.get<Room | string>(key(code));
    if (!raw) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as Room) : raw;
  }

  async create(room: Room): Promise<boolean> {
    const res = await this.redis.set(key(room.code), JSON.stringify(room), { nx: true, ex: ROOM.ttlSeconds });
    return res === "OK";
  }

  async update(room: Room, expectedRev: number): Promise<boolean> {
    const res = await this.redis.eval(CAS_SCRIPT, [key(room.code)], [String(expectedRev), JSON.stringify(room), String(ROOM.ttlSeconds)]);
    return Number(res) === 1;
  }

  async delete(code: string): Promise<void> {
    await this.redis.del(key(code));
  }
}

/** In-process fallback for local development without Redis. Not shared across instances. */
class MemoryStore implements RoomStore {
  private rooms = new Map<string, { room: Room; expiresAt: number }>();

  private live(code: string) {
    const entry = this.rooms.get(code);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.rooms.delete(code);
      return null;
    }
    return entry;
  }

  async get(code: string): Promise<Room | null> {
    const entry = this.live(code);
    return entry ? structuredClone(entry.room) : null;
  }

  async create(room: Room): Promise<boolean> {
    if (this.live(room.code)) return false;
    this.rooms.set(room.code, { room: structuredClone(room), expiresAt: Date.now() + ROOM.ttlSeconds * 1000 });
    return true;
  }

  async update(room: Room, expectedRev: number): Promise<boolean> {
    const entry = this.live(room.code);
    if (!entry || entry.room.rev !== expectedRev) return false;
    this.rooms.set(room.code, { room: structuredClone(room), expiresAt: Date.now() + ROOM.ttlSeconds * 1000 });
    return true;
  }

  async delete(code: string): Promise<void> {
    this.rooms.delete(code);
  }
}

function redisFromEnv(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token, automaticDeserialization: false });
}

const globalForStore = globalThis as unknown as { __imposterStore?: RoomStore };

export function getStore(): RoomStore {
  if (!globalForStore.__imposterStore) {
    const redis = redisFromEnv();
    if (redis) {
      globalForStore.__imposterStore = new RedisStore(redis);
    } else {
      if (process.env.NODE_ENV === "production") {
        console.warn("[imposter] No Redis configured; using an in-memory room store that is NOT shared between instances.");
      }
      globalForStore.__imposterStore = new MemoryStore();
    }
  }
  return globalForStore.__imposterStore;
}
