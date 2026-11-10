import type { Round, Session, Settings } from "./types";

const KEYS = {
  settings: "imposter.settings.v1",
  session: "imposter.session.v1",
  round: "imposter.round.v1",
} as const;

export const DEFAULT_SETTINGS: Settings = {
  players: ["", "", "", ""],
  categoryIds: [],
  imposterHint: false,
  showEnglish: true,
  wordDisplay: "both",
  timerSeconds: 120,
  voteMode: "group",
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const isNumArr = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === "number");
const isInt = (v: unknown): v is number => Number.isInteger(v);

export function isSettings(v: unknown): v is Settings {
  return (
    isObj(v) &&
    isStrArr(v.players) &&
    isStrArr(v.categoryIds) &&
    typeof v.imposterHint === "boolean" &&
    typeof v.showEnglish === "boolean" &&
    (v.wordDisplay === undefined || ["both", "en", "ml"].includes(v.wordDisplay as string)) &&
    [0, 60, 120, 180].includes(v.timerSeconds as number) &&
    (v.voteMode === "group" || v.voteMode === "secret")
  );
}

export function isSession(v: unknown): v is Session {
  return (
    isObj(v) &&
    isStrArr(v.players) &&
    isNumArr(v.scores) &&
    v.players.length === v.scores.length &&
    isInt(v.roundsPlayed) &&
    isStrArr(v.usedWords)
  );
}

export function isRound(v: unknown): v is Round {
  return (
    isObj(v) &&
    typeof v.id === "string" &&
    isInt(v.number) &&
    isObj(v.word) &&
    typeof v.word.ml === "string" &&
    typeof v.word.en === "string" &&
    typeof v.categoryId === "string" &&
    isInt(v.imposter) &&
    isInt(v.starter) &&
    ["peek", "clues", "vote", "reveal"].includes(v.phase as string) &&
    isInt(v.peekIndex) &&
    Array.isArray(v.votes) &&
    v.votes.every((x) => x === null || isInt(x)) &&
    (v.voted === null || isInt(v.voted)) &&
    (v.guessedWord === null || typeof v.guessedWord === "boolean") &&
    typeof v.scored === "boolean"
  );
}

/**
 * Reads and validates a stored value. Results are cached per raw string so the same
 * object is returned until the stored text changes, which lets useSyncExternalStore
 * compare snapshots by identity.
 */
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, guard: (v: unknown) => v is T): T | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T | null;
  let value: T | null = null;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      value = guard(parsed) ? parsed : null;
    } catch {
      value = null;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

/** Fired on this window whenever the game writes to storage, so same-tab subscribers can refresh. */
export const STORAGE_EVENT = "imposter-storage";

function notify(): void {
  try {
    window.dispatchEvent(new Event(STORAGE_EVENT));
  } catch {
    // ignore
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, quota); the game still works for this session.
  }
  notify();
}

function erase(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
  notify();
}

/** Subscribe to storage changes from this tab (custom event) and other tabs (storage event). */
export function subscribeStorage(callback: () => void): () => void {
  window.addEventListener(STORAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export const loadSettings = (): Settings => read(KEYS.settings, isSettings) ?? DEFAULT_SETTINGS;
export const saveSettings = (s: Settings): void => write(KEYS.settings, s);

export const loadSession = (): Session | null => read(KEYS.session, isSession);
export const saveSession = (s: Session): void => write(KEYS.session, s);
export const clearSession = (): void => erase(KEYS.session);

export const loadRound = (): Round | null => read(KEYS.round, isRound);
export const saveRound = (r: Round): void => write(KEYS.round, r);
export const clearRound = (): void => erase(KEYS.round);
