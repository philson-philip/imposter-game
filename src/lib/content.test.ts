import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/data/words";
import { categoryName, settingsDisplay, wordParts } from "./content";
import { newSession, createRound, pickWord } from "./game";
import { DEFAULT_SETTINGS, isSettings } from "./storage";

describe("localized game content", () => {
  it("translates old saved words without changing their stored identity", () => {
    const saved = { ml: "കപ്പ", en: "Kappa" };
    expect(wordParts(saved, "en", "food").primary).toBe("Tapioca");
    expect(saved).toEqual({ ml: "കപ്പ", en: "Kappa" });
  });

  it("keeps original Malayalam while changing display language", () => {
    const word = CATEGORIES[0].words[0];
    expect(wordParts(word, "ml").primary).toBe(word.ml);
    expect(wordParts(word, "ml").secondary).toBeNull();
    expect(wordParts(word, "en").primary).toBe(word.en);
    expect(wordParts(word, "en").secondary).toBeNull();
    expect(wordParts(word, "both").secondary).toBe(word.en);
  });

  it("uses English-only fallback text when a translation is missing", () => {
    expect(wordParts({ ml: "പരിഭാഷയില്ലാത്ത പദം", en: "" }, "en").primary).toBe("English translation unavailable");
    expect(wordParts({ ml: "പരിഭാഷയില്ലാത്ത പദം", en: "മലയാളം" }, "en").primary).not.toMatch(/[\u0d00-\u0d7f]/u);
    expect(categoryName({ id: "new-category", en: "", ml: "പുതിയ വിഭാഗം" }, "en")).toBe("New category");
  });

  it("preserves language preferences from older saved settings", () => {
    expect(settingsDisplay({ showEnglish: true })).toBe("both");
    expect(settingsDisplay({ showEnglish: false })).toBe("ml");
    expect(settingsDisplay({ showEnglish: false, wordDisplay: "en" })).toBe("en");
    const legacy = { ...DEFAULT_SETTINGS };
    delete legacy.wordDisplay;
    expect(isSettings({ ...legacy, showEnglish: false })).toBe(true);
    expect(isSettings({ ...legacy, wordDisplay: "en" })).toBe(true);
    expect(isSettings({ ...legacy, wordDisplay: "unknown" })).toBe(false);
  });

  it("keeps English and Malayalam content available across the complete catalog", () => {
    for (const category of CATEGORIES) {
      expect(categoryName(category, "en")).not.toMatch(/[\u0d00-\u0d7f]/u);
      expect(categoryName(category, "ml")).toBe(category.ml);
      for (const word of category.words) {
        const english = wordParts(word, "en", category.id);
        expect(english.primary).toBe(word.en);
        expect(english.secondary).toBeNull();
        expect(english.primary).not.toMatch(/[\u0d00-\u0d7f]/u);
        expect(wordParts(word, "ml", category.id).primary).toBe(word.ml);
      }
    }
  });

  it("resolves legacy labels by category when a title is also a character", () => {
    const saved = { ml: "രാജമാണിക്യം", en: "Rajamanikyam" };
    expect(wordParts(saved, "en", "movies").primary).toBe("Rajamanikyam");
    expect(wordParts(saved, "en", "characters").primary).toBe("Bellary Raja (Rajamanikyam)");
  });

  it("initializes both languages from the same complete category pools without changing the session", () => {
    const session = newSession(["A", "B", "C"]);
    const before = JSON.stringify(session);
    for (const wordDisplay of ["en", "ml"] as const) {
      for (const category of CATEGORIES) {
        const { round } = createRound({ ...DEFAULT_SETTINGS, wordDisplay, categoryIds: [category.id] }, session, CATEGORIES, 1);
        expect(round.categoryId).toBe(category.id);
        const displayed = wordParts(round.word, wordDisplay, category.id).primary;
        expect(displayed).toBe(wordDisplay === "en" ? round.word.en : round.word.ml);
      }
    }
    expect(JSON.stringify(session)).toBe(before);
    expect(() => pickWord([{ id: "empty", en: "Empty", ml: "ശൂന്യം", emoji: "", words: [] }], [], [])).toThrow("No words available");
  });
});
