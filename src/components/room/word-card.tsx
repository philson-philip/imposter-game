"use client";

import { useState } from "react";
import type { CategoryInfo, WordDisplay } from "@/lib/room-types";
import type { Word } from "@/lib/types";
import { Mark } from "../mark";

export function wordParts(word: Word, mode: WordDisplay): { primary: string; primaryLang: "ml" | "en"; secondary: string | null } {
  if (mode === "en") return { primary: word.en, primaryLang: "en", secondary: null };
  if (mode === "ml") return { primary: word.ml, primaryLang: "ml", secondary: null };
  return { primary: word.ml, primaryLang: "ml", secondary: word.en };
}

function sizeFor(text: string): string {
  const len = Array.from(text).length;
  if (len <= 8) return "text-4xl";
  if (len <= 14) return "text-3xl";
  return "text-2xl";
}

export function YourCard({
  isImposter,
  word,
  category,
  mode,
}: {
  isImposter: boolean;
  word: Word | null;
  category: CategoryInfo | null;
  mode: WordDisplay;
}) {
  const [hidden, setHidden] = useState(false);
  const tone = isImposter ? "rose" : "violet";
  const frame =
    tone === "rose"
      ? "border-rose-500/40 bg-linear-to-b from-rose-600/25 to-ink-800"
      : "border-violet-500/40 bg-linear-to-b from-violet-600/25 to-ink-800";
  const pill = tone === "rose" ? "bg-rose-500/20 text-rose-300" : "bg-violet-500/20 text-violet-300";

  return (
    <section aria-label="Your card" className={`rounded-3xl border p-4 ${frame}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${pill}`}>
          {isImposter ? "Imposter" : category ? `${category.emoji} ${category.en}` : "Your word"}
        </span>
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          className="rounded-lg px-2 py-1 text-sm font-semibold text-mist-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          {hidden ? "Show" : "Hide"}
        </button>
      </div>

      {hidden ? (
        <p className="py-8 text-center text-mist-400">Hidden. Tap Show when nobody&apos;s looking.</p>
      ) : isImposter ? (
        <div className="flex items-center gap-4 py-4">
          <Mark tone="rose" className="h-16 w-16 shrink-0" title="" />
          <div>
            <p className="text-2xl font-extrabold leading-tight text-white">You&apos;re the Imposter</p>
            <p lang="ml" className="text-sm font-semibold text-rose-300">
              നിങ്ങളാണ് ഇംപോസ്റ്റർ
            </p>
            <p className="mt-2 text-sm leading-snug text-mist-300">
              {category ? (
                <>
                  You don&apos;t know the word, but it&apos;s about{" "}
                  <span className="font-semibold text-white">
                    {category.emoji} {category.en}
                  </span>
                  . Bluff.
                </>
              ) : (
                <>You don&apos;t know the word. Listen to the clues and blend in.</>
              )}
            </p>
          </div>
        </div>
      ) : word ? (
        <WordText word={word} mode={mode} />
      ) : (
        <p className="py-8 text-center text-mist-400">You&apos;ll get a word from the next round.</p>
      )}
    </section>
  );
}

export function WordText({ word, mode, compact = false }: { word: Word; mode: WordDisplay; compact?: boolean }) {
  const { primary, primaryLang, secondary } = wordParts(word, mode);
  return (
    <div className={`text-center ${compact ? "py-2" : "py-6"}`}>
      <p lang={primaryLang} className={`font-extrabold leading-[1.3] text-white [overflow-wrap:anywhere] ${compact ? "text-2xl" : sizeFor(primary)}`}>
        {primary}
      </p>
      {secondary && <p className={`mt-1 font-medium text-violet-300 ${compact ? "text-base" : "text-xl"}`}>{secondary}</p>}
    </div>
  );
}
