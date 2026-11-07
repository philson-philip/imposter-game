import type { Category, Settings, Word, WordDisplay } from "./types";

export function settingsDisplay(settings: Pick<Settings, "wordDisplay" | "showEnglish">): WordDisplay {
  return settings.wordDisplay ?? (settings.showEnglish ? "both" : "ml");
}

export function uiLanguage(mode: WordDisplay): "en" | "ml" {
  return mode === "ml" ? "ml" : "en";
}

export function categoryName(category: Pick<Category, "id" | "en" | "ml">, mode: WordDisplay): string {
  return mode === "ml" ? category.ml : category.en;
}

export function wordParts(word: Word, mode: WordDisplay, categoryId?: string): { primary: string; primaryLang: "ml" | "en"; secondary: string | null } {
  void categoryId;
  if (mode === "en") return { primary: word.en, primaryLang: "en", secondary: null };
  if (mode === "ml") return { primary: word.ml, primaryLang: "ml", secondary: null };
  return { primary: word.ml, primaryLang: "ml", secondary: word.en };
}
