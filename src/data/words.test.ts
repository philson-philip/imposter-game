import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_BY_ID, TOTAL_WORDS } from "./words";

const categoryIds = ["food", "movies", "characters", "festivals", "gulf", "college", "places", "daily", "sports", "nature"];
const malayalamScript = /[\u0D00-\u0D7F]/u;

describe("bilingual topic catalog", () => {
  it("keeps all ten categories and the complete 480-topic collection", () => {
    expect(CATEGORIES.map((category) => category.id)).toEqual(categoryIds);
    expect(TOTAL_WORDS).toBe(480);
    for (const category of CATEGORIES) {
      expect(category.words).toHaveLength(48);
      expect(CATEGORY_BY_ID[category.id]).toBe(category);
    }
  });

  it("preserves the original ordered Malayalam categories and topics exactly", () => {
    const malayalamCatalog = CATEGORIES.map(({ id, ml, words }) => ({
      id,
      ml,
      words: words.map((word) => word.ml),
    }));
    // Hash of the same projection at 24076a3; avoids duplicating all 480 strings.
    expect(createHash("sha256").update(JSON.stringify(malayalamCatalog)).digest("hex"))
      .toBe("7259b77c8627a38b668b72c18859eb98bf9a5056b000ec932f391749e5d3386b");
  });

  it("provides nonempty bilingual labels and English-only English fields throughout", () => {
    for (const category of CATEGORIES) {
      for (const item of [category, ...category.words]) {
        expect(item.ml.trim()).not.toBe("");
        expect(item.en.trim()).not.toBe("");
        expect(item.en).not.toMatch(malayalamScript);
        expect(item.en).not.toMatch(/\b(?:undefined|null)\b/iu);
      }
    }
  });

  it("gives every topic a unique permanent category-prefixed ID", () => {
    const ids = new Set<string>();
    for (const category of CATEGORIES) {
      for (const word of category.words) {
        expect(word.id).toMatch(new RegExp(`^${category.id}-\\d{3}$`));
        expect(ids.has(word.id!)).toBe(false);
        ids.add(word.id!);
      }
    }
    expect(ids.size).toBe(TOTAL_WORDS);
  });

  it("uses English meanings for ordinary words while retaining recognizable proper names", () => {
    expect(CATEGORY_BY_ID.nature.words.find((word) => word.ml === "ആന")?.en).toBe("Elephant");
    expect(CATEGORY_BY_ID.daily.words.find((word) => word.ml === "കുട")?.en).toBe("Umbrella");
    expect(CATEGORY_BY_ID.movies.words.find((word) => word.ml === "കിരീടം")?.en).toBe("Kireedam");
    expect(CATEGORY_BY_ID.places.words.find((word) => word.ml === "മൂന്നാർ")?.en).toBe("Munnar");
  });

  it("keeps ordinary words shared across categories translated consistently", () => {
    const translations = new Map<string, string>();
    for (const category of CATEGORIES) {
      // Film titles and characters can share a Malayalam label but have different referents.
      if (category.id === "movies" || category.id === "characters") continue;
      for (const word of category.words) {
        if (translations.has(word.ml)) expect(word.en).toBe(translations.get(word.ml));
        translations.set(word.ml, word.en);
      }
    }
  });

  it("retains previous transliterations for matching saved sessions", () => {
    expect(CATEGORY_BY_ID.nature.words.find((word) => word.id === "nature-001"))
      .toMatchObject({ ml: "ആന", en: "Elephant", transliteration: "Aana" });
    expect(CATEGORY_BY_ID.daily.words.find((word) => word.id === "daily-005"))
      .toMatchObject({ ml: "കുട", en: "Umbrella", transliteration: "Kuda" });
  });
});
