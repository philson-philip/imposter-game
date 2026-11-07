"use client";

import type { Category, Word } from "@/lib/types";
import { Mark } from "./mark";

function wordSize(ml: string): string {
  const len = Array.from(ml).length;
  if (len <= 7) return "text-5xl";
  if (len <= 12) return "text-4xl";
  return "text-3xl";
}

export function SecretCard({
  player,
  flipped,
  onFlip,
  isImposter,
  word,
  category,
  showEnglish,
  showHint,
}: {
  player: string;
  flipped: boolean;
  onFlip: () => void;
  isImposter: boolean;
  word: Word;
  category: Category;
  showEnglish: boolean;
  showHint: boolean;
}) {
  return (
    <div className="perspective w-full">
      <button
        type="button"
        onClick={onFlip}
        aria-pressed={flipped}
        aria-label={flipped ? "Hide the card" : `Reveal the card for ${player}`}
        className={`card-3d relative block aspect-[4/5] w-full rounded-[28px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-4 focus-visible:ring-offset-ink-950 ${flipped ? "is-flipped" : ""}`}
      >
        {/* Face down */}
        <div className="card-face absolute inset-0 flex flex-col items-center justify-center rounded-[28px] border border-ink-700 bg-ink-800 bg-[repeating-linear-gradient(135deg,transparent_0_14px,rgba(255,255,255,0.025)_14px_28px)] p-6 text-center">
          <Mark className="h-20 w-20 opacity-90" title="" />
          <p className="mt-6 text-xl font-bold text-white">Tap to reveal</p>
          <p className="mt-1 text-sm text-mist-400">For {player}&apos;s eyes only</p>
        </div>

        {/* Face up: rendered only while flipped so the secret never sits in the DOM early */}
        <div
          className={`card-face card-back absolute inset-0 flex flex-col rounded-[28px] border p-6 ${
            isImposter
              ? "border-rose-500/50 bg-linear-to-b from-rose-600/30 to-ink-800 shadow-[0_0_90px_-20px_rgba(244,63,94,0.75)]"
              : "border-violet-500/50 bg-linear-to-b from-violet-600/30 to-ink-800 shadow-[0_0_90px_-20px_rgba(139,92,246,0.85)]"
          }`}
        >
          {flipped &&
            (isImposter ? (
              <>
                <span className="self-start rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-300">
                  Imposter
                </span>
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <Mark tone="rose" className="h-20 w-20" title="" />
                  <p className="mt-5 text-3xl font-extrabold leading-tight text-white">You&apos;re the Imposter</p>
                  <p lang="ml" className="mt-1 text-lg font-semibold text-rose-300">
                    നിങ്ങളാണ് ഇംപോസ്റ്റർ
                  </p>
                  <p className="mt-4 text-base leading-snug text-mist-300">
                    {showHint ? (
                      <>
                        You don&apos;t know the word, but it&apos;s about{" "}
                        <span className="font-semibold text-white">
                          {category.emoji} {category.en}
                        </span>
                        .
                      </>
                    ) : (
                      <>You don&apos;t know the word. Listen to the clues and blend in.</>
                    )}
                  </p>
                </div>
                <p className="text-center text-sm text-mist-400">Bluff. Nod. Survive the vote.</p>
              </>
            ) : (
              <>
                <span className="self-start rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-300">
                  {category.emoji} {category.en}
                </span>
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <p className="text-sm text-mist-400">Your secret word</p>
                  <p
                    lang="ml"
                    className={`mt-3 w-full font-extrabold leading-[1.3] text-white [overflow-wrap:anywhere] ${wordSize(word.ml)}`}
                  >
                    {word.ml}
                  </p>
                  {showEnglish && <p className="mt-2 text-xl font-medium text-violet-300">{word.en}</p>}
                </div>
                <p className="text-center text-sm text-mist-400">Give a clue. Never say the word.</p>
              </>
            ))}
        </div>
      </button>
    </div>
  );
}
