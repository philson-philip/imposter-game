import type { Category, Round, Session, Settings, Word } from "./types";

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;

export const SCORING = {
  /** Each crew member earns this when the imposter is voted out. */
  crewCatch: 1,
  /** The imposter earns this when someone else (or nobody) is voted out. */
  imposterEscape: 3,
  /** A caught imposter earns this by guessing the word. */
  imposterGuess: 2,
} as const;

/** Uniform random integer in [0, n). Uses the Web Crypto API when available. */
export function randomInt(n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new Error(`randomInt: invalid n ${n}`);
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === "function") {
    const limit = Math.floor(0x100000000 / n) * n; // rejection sampling, no modulo bias
    const buf = new Uint32Array(1);
    let x: number;
    do {
      c.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    return x % n;
  }
  return Math.floor(Math.random() * n);
}

export function wordKey(categoryId: string, word: Word): string {
  return `${categoryId}:${word.ml}`;
}

/** Spelling-level identity of a word, so the same word listed in two categories counts once. */
export function wordIdentity(ml: string): string {
  return ml.replace(/\s+/g, "");
}

function identityOfKey(key: string): string {
  return wordIdentity(key.slice(key.indexOf(":") + 1));
}

/** Categories in play for the given selection; an empty selection means all. */
export function selectCategories(all: Category[], ids: string[]): Category[] {
  const chosen = ids.length ? all.filter((c) => ids.includes(c.id)) : all;
  return chosen.length ? chosen : all;
}

export function countWords(all: Category[], ids: string[]): number {
  return selectCategories(all, ids).reduce((n, c) => n + c.words.length, 0);
}

export type WordPick = { word: Word; categoryId: string; usedReset: boolean };

/**
 * Picks a word not yet used this session. When every word in the selected
 * categories has been played, the pool is reset (usedReset = true).
 */
export function pickWord(all: Category[], ids: string[], used: string[]): WordPick {
  const pool = selectCategories(all, ids).flatMap((c) =>
    c.words.map((word) => ({ word, categoryId: c.id })),
  );
  if (pool.length === 0) throw new Error("No words available");
  const usedIdentities = new Set(used.map(identityOfKey));
  let fresh = pool.filter((p) => !usedIdentities.has(wordIdentity(p.word.ml)));
  let usedReset = false;
  if (fresh.length === 0) {
    fresh = pool;
    usedReset = true;
  }
  const pick = fresh[randomInt(fresh.length)];
  return { word: pick.word, categoryId: pick.categoryId, usedReset };
}

export function createRound(
  settings: Settings,
  session: Session,
  all: Category[],
  number: number,
): { round: Round; usedWords: string[] } {
  const n = session.players.length;
  if (n < MIN_PLAYERS) throw new Error("Not enough players");
  const { word, categoryId, usedReset } = pickWord(all, settings.categoryIds, session.usedWords);
  const inPlay = new Set(selectCategories(all, settings.categoryIds).map((c) => c.id));
  const base = usedReset
    ? session.usedWords.filter((k) => !inPlay.has(k.slice(0, k.indexOf(":"))))
    : session.usedWords;
  const usedWords = [...base, wordKey(categoryId, word)];
  const round: Round = {
    id: `${number}-${randomInt(1_000_000_000)}`,
    number,
    word,
    categoryId,
    imposter: randomInt(n),
    starter: randomInt(n),
    phase: "peek",
    peekIndex: 0,
    votes: Array.from({ length: n }, () => null),
    voted: null,
    guessedWord: null,
    scored: false,
  };
  return { round, usedWords };
}

/** Clue order: everyone once, starting with the starter and going around. */
export function clueOrder(starter: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => (starter + i) % n);
}

export type Tally = { counts: number[]; leaders: number[]; eliminated: number | null };

/** Counts votes; a player is eliminated only when they alone have the most votes. */
export function tallyVotes(votes: (number | null)[], n: number): Tally {
  const counts = Array.from({ length: n }, () => 0);
  for (const v of votes) {
    if (v !== null && Number.isInteger(v) && v >= 0 && v < n) counts[v] += 1;
  }
  const max = Math.max(0, ...counts);
  const leaders = max > 0 ? counts.flatMap((c, i) => (c === max ? [i] : [])) : [];
  return { counts, leaders, eliminated: leaders.length === 1 ? leaders[0] : null };
}

export function imposterCaught(round: Pick<Round, "voted" | "imposter">): boolean {
  return round.voted === round.imposter;
}

/** Score deltas for every player for a finished round. */
export function scoreRound(round: Round, n: number): number[] {
  const d = Array.from({ length: n }, () => 0);
  if (imposterCaught(round)) {
    for (let i = 0; i < n; i++) if (i !== round.imposter) d[i] += SCORING.crewCatch;
    if (round.guessedWord) d[round.imposter] += SCORING.imposterGuess;
  } else {
    d[round.imposter] += SCORING.imposterEscape;
  }
  return d;
}

/** Trims names, drops blanks and makes duplicates unique ("Anu", "Anu 2"). */
export function normalizePlayers(names: string[]): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, 24);
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    out.push(count === 0 ? name : `${name} ${count + 1}`);
  }
  return out;
}

export function playersError(names: string[]): string | null {
  if (names.length < MIN_PLAYERS) return `Add at least ${MIN_PLAYERS} players to start.`;
  if (names.length > MAX_PLAYERS) return `Keep it to ${MAX_PLAYERS} players or fewer.`;
  return null;
}

export function newSession(players: string[]): Session {
  return { players, scores: players.map(() => 0), roundsPlayed: 0, usedWords: [] };
}
