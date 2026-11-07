import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/data/words";
import { categoryName, settingsDisplay, wordParts } from "./content";

describe("localized game content", () => {
  it("translates old saved words without changing their stored identity", () => {
    const saved = { ml: "കപ്പ", en: "Kappa" };
    expect(wordParts(saved, "en", "food").primary).toBe("Cassava");
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
  });
});
