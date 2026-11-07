import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoom } from "@/lib/room-logic";
import { getStore } from "./store";

const redis = vi.hoisted(() => ({ set: vi.fn(), eval: vi.fn() }));
vi.mock("@upstash/redis", () => ({ Redis: class { set = redis.set; eval = redis.eval; } }));

const state = globalThis as unknown as { __imposterStore?: ReturnType<typeof getStore> };

beforeEach(() => {
  delete state.__imposterStore;
  for (const name of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) {
    vi.stubEnv(name, "");
  }
  vi.stubEnv("NODE_ENV", "development");
  vi.clearAllMocks();
});

afterEach(() => {
  delete state.__imposterStore;
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("room persistence", () => {
  it("refuses to create ephemeral production rooms without Redis", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getStore()).toThrow(/Redis/);
  });

  it.each(["UPSTASH_REDIS_REST", "KV_REST_API"])("sets a 12-hour TTL on creation and updates using %s", async (prefix) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(`${prefix}_URL`, "https://redis.example.com");
    vi.stubEnv(`${prefix}_TOKEN`, "test-token");
    redis.set.mockResolvedValue("OK");
    redis.eval.mockResolvedValue(1);
    const { room } = createRoom("ABCDE", "Host", Date.now());
    const store = getStore();
    expect(await store.create(room)).toBe(true);
    expect(redis.set).toHaveBeenCalledWith("room:ABCDE", JSON.stringify(room), { nx: true, ex: 43200 });
    expect(await store.update({ ...room, rev: room.rev + 1 }, room.rev)).toBe(true);
    expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("'EX', ARGV[3]"), ["room:ABCDE"], [String(room.rev), expect.any(String), "43200"]);
  });

  it("keeps local rooms beyond 10 minutes and expires them at 12 hours", async () => {
    vi.useFakeTimers();
    const { room } = createRoom("ABCDE", "Host", Date.now());
    const store = getStore();
    await store.create(room);
    vi.advanceTimersByTime(11 * 60 * 1000);
    expect(await store.get(room.code)).toEqual(room);
    vi.advanceTimersByTime((12 * 60 - 11) * 60 * 1000);
    expect(await store.get(room.code)).toBeNull();
  });
});
