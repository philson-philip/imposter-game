import type { Category, Settings, Word, WordDisplay } from "./types";
import { CATEGORIES } from "@/data/words";

const wordsById = new Map(CATEGORIES.flatMap((category) => category.words.flatMap((word) => word.id ? [[word.id, word] as const] : [])));
const wordsByMalayalam = new Map<string, Word[]>();
for (const category of CATEGORIES) {
  for (const word of category.words) {
    const matches = wordsByMalayalam.get(word.ml) ?? [];
    matches.push(word);
    wordsByMalayalam.set(word.ml, matches);
  }
}

function englishText(value: string | undefined, fallback: string): string {
  const text = value?.trim();
  return text && !/[\u0d00-\u0d7f]/u.test(text) ? text : fallback;
}

export function resolveWord(word: Word, categoryId?: string): Word {
  const identified = word.id ? wordsById.get(word.id) : undefined;
  if (identified?.ml === word.ml) return identified;
  const categorized = categoryId ? CATEGORIES.find((category) => category.id === categoryId)?.words.find((candidate) => candidate.ml === word.ml) : undefined;
  if (categorized) return categorized;
  const matches = wordsByMalayalam.get(word.ml) ?? [];
  return matches.find((candidate) => candidate.en === word.en || candidate.transliteration === word.en) ?? matches[0] ?? word;
}

export function settingsDisplay(settings: Pick<Settings, "wordDisplay" | "showEnglish">): WordDisplay {
  return settings.wordDisplay ?? (settings.showEnglish ? "both" : "ml");
}

export function uiLanguage(mode: WordDisplay): "en" | "ml" {
  return mode === "ml" ? "ml" : "en";
}

export function categoryName(category: Pick<Category, "id" | "en" | "ml">, mode: WordDisplay): string {
  const fallback = category.id.replace(/[-_]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
  return mode === "ml" ? category.ml.trim() || "വിഭാഗം ലഭ്യമല്ല" : englishText(category.en, englishText(fallback, "Category unavailable"));
}

export function wordParts(word: Word, mode: WordDisplay, categoryId?: string): { primary: string; primaryLang: "ml" | "en"; secondary: string | null } {
  const current = resolveWord(word, categoryId);
  const english = englishText(current.en, "English translation unavailable");
  const malayalam = current.ml.trim() || "പരിഭാഷ ലഭ്യമല്ല";
  if (mode === "en") return { primary: english, primaryLang: "en", secondary: null };
  if (mode === "ml") return { primary: malayalam, primaryLang: "ml", secondary: null };
  return { primary: malayalam, primaryLang: "ml", secondary: english };
}

export const CONTENT_LABELS = {
  en: { everything: "Everything", category: "Category for this round", wordDisplay: "Show words as", noWords: "No words available in these categories. Choose another category." },
  ml: { everything: "എല്ലാം", category: "ഈ റൗണ്ടിലെ വിഭാഗം", wordDisplay: "വാക്കുകളുടെ ഭാഷ", noWords: "ഈ വിഭാഗങ്ങളിൽ വാക്കുകളില്ല. മറ്റൊരു വിഭാഗം തിരഞ്ഞെടുക്കുക." },
};
