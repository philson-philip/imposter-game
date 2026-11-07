import { describe, expect, it } from "vitest";
import {
  SCORING,
  clueOrder,
  createRound,
  newSession,
  normalizePlayers,
  pickWord,
  playersError,
  randomInt,
  scoreRound,
  tallyVotes,
  wordKey,
} from "./game";
import type { Category, Round } from "./types";

const cats: Category[] = [
  { id: "a", en: "A", ml: "എ", emoji: "🅰️", words: [{ ml: "ഒന്ന്", en: "One" }, { ml: "രണ്ട്", en: "Two" }] },
  { id: "b", en: "B", ml: "ബി", emoji: "🅱️", words: [{ ml: "മൂന്ന്", en: "Three" }] },
];

describe("randomInt", () => {
  it("stays within range", () => {
    for (let i = 0; i < 500; i++) {
      const x = randomInt(7);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(7);
    }
    expect(() => randomInt(0)).toThrow();
  });
});

describe("pickWord", () => {
  it("never repeats until the selected pool is exhausted", () => {
    const used: string[] = [];
    for (let i = 0; i < 3; i++) {
      const p = pickWord(cats, [], used);
      expect(p.usedReset).toBe(false);
      used.push(wordKey(p.categoryId, p.word));
    }
    expect(new Set(used).size).toBe(3);
    const again = pickWord(cats, [], used);
    expect(again.usedReset).toBe(true);
  });

  it("respects the category selection", () => {
    for (let i = 0; i < 20; i++) expect(pickWord(cats, ["b"], []).categoryId).toBe("b");
  });

  it("falls back to every category when the selection is unknown", () => {
    expect(() => pickWord(cats, ["zzz"], [])).not.toThrow();
  });
});

describe("createRound", () => {
  it("builds a valid round and extends the used-word list", () => {
    const settings = { players: ["A", "B", "C"], categoryIds: [], imposterHint: false, showEnglish: true, timerSeconds: 0 as const, voteMode: "group" as const };
    const session = newSession(settings.players);
    const { round, usedWords } = createRound(settings, session, cats, 1);
    expect(round.imposter).toBeGreaterThanOrEqual(0);
    expect(round.imposter).toBeLessThan(3);
    expect(round.votes).toEqual([null, null, null]);
    expect(usedWords).toContain(wordKey(round.categoryId, round.word));
  });

  it("only forgets used words from the categories in play when the pool resets", () => {
    const settings = { players: ["A", "B", "C"], categoryIds: ["b"], imposterHint: false, showEnglish: true, timerSeconds: 0 as const, voteMode: "group" as const };
    const session = { ...newSession(settings.players), usedWords: ["a:ഒന്ന്", "b:മൂന്ന്"] };
    const { usedWords } = createRound(settings, session, cats, 2);
    expect(usedWords).toEqual(["a:ഒന്ന്", "b:മൂന്ന്"]);
  });
});

describe("tallyVotes", () => {
  it("eliminates a unique leader and reports ties", () => {
    expect(tallyVotes([1, 1, 0], 3)).toMatchObject({ eliminated: 1, leaders: [1] });
    expect(tallyVotes([1, 0, null], 3)).toMatchObject({ eliminated: null, leaders: [0, 1] });
    expect(tallyVotes([null, null, null], 3)).toMatchObject({ eliminated: null, leaders: [] });
    expect(tallyVotes([9, -1, 2], 3).counts).toEqual([0, 0, 1]);
  });
});

describe("scoreRound", () => {
  const base: Round = {
    id: "r",
    number: 1,
    word: { ml: "ഒന്ന്", en: "One" },
    categoryId: "a",
    imposter: 2,
    starter: 0,
    phase: "reveal",
    peekIndex: 0,
    votes: [],
    voted: null,
    guessedWord: null,
    scored: false,
  };
  it("rewards the crew when the imposter is caught", () => {
    expect(scoreRound({ ...base, voted: 2 }, 4)).toEqual([1, 1, 0, 1]);
  });
  it("gives a caught imposter points for guessing the word", () => {
    expect(scoreRound({ ...base, voted: 2, guessedWord: true }, 4)).toEqual([1, 1, SCORING.imposterGuess, 1]);
  });
  it("rewards the imposter for escaping, including when nobody is voted out", () => {
    expect(scoreRound({ ...base, voted: 0 }, 4)).toEqual([0, 0, SCORING.imposterEscape, 0]);
    expect(scoreRound({ ...base, voted: null }, 4)).toEqual([0, 0, SCORING.imposterEscape, 0]);
  });
});

describe("players", () => {
  it("normalizes names and makes duplicates unique", () => {
    expect(normalizePlayers(["  Anu ", "", "anu", "Biju", "Anu"])).toEqual(["Anu", "anu 2", "Biju", "Anu 3"]);
  });
  it("enforces the player range", () => {
    expect(playersError(["a", "b"])).toMatch(/at least/);
    expect(playersError(Array.from({ length: 11 }, (_, i) => `p${i}`))).toMatch(/or fewer/);
    expect(playersError(["a", "b", "c"])).toBeNull();
  });
  it("rotates the clue order from the starter", () => {
    expect(clueOrder(2, 4)).toEqual([2, 3, 0, 1]);
  });
});
