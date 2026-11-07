import type { Metadata } from "next";
import { Screen } from "@/components/shell";
import { ButtonLink } from "@/components/ui";
import { SCORING } from "@/lib/game";

export const metadata: Metadata = {
  title: "How to play",
  description: "Rules and scoring for Imposter, the Malayalam party word game.",
};

const STEPS = [
  {
    title: "Enter player names",
    body: "Add everyone playing, 3 to 10 people. Pick the word categories you want, from Food and Movies to Gulf life and College.",
  },
  {
    title: "Pass & peek",
    body: "Pass the phone around. Each player secretly flips their card to see the word. The Imposter's card says only that they are the Imposter.",
  },
  {
    title: "Give clues",
    body: "Starting with the player shown on screen, everyone says one clue about the word. Be clear enough for the crew, vague enough to keep the Imposter guessing. The Imposter has to bluff.",
  },
  {
    title: "Vote & reveal",
    body: "Discuss, then vote out the player you suspect. In online rooms, an innocent player sits out until the next round. The host can continue with more clues and votes, or end the round so the hidden Imposter wins. If the Imposter is caught, they get one last chance to guess the word.",
  },
];

export default function HowToPlay() {
  return (
    <Screen>
      <header className="pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-500">Rules</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-white">How to play</h1>
      </header>

      <ol className="mt-8 space-y-6">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/15 font-mono text-sm font-bold text-violet-300">
              {i + 1}
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">{s.title}</h2>
              <p className="mt-1 leading-relaxed text-mist-400">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-mist-500">Scoring</h2>
        <dl className="mt-3 divide-y divide-ink-700 border-y border-ink-700">
          <div className="flex items-center justify-between py-3">
            <dt className="text-mist-300">Crew votes out the Imposter</dt>
            <dd className="font-mono font-semibold text-emerald-400">+{SCORING.crewCatch} each</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-mist-300">Host ends the round with Imposter uncaught</dt>
            <dd className="font-mono font-semibold text-rose-400">+{SCORING.imposterEscape} Imposter</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-mist-300">Caught Imposter guesses the word</dt>
            <dd className="font-mono font-semibold text-rose-400">+{SCORING.imposterGuess} Imposter</dd>
          </div>
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-mist-500">Tips</h2>
        <ul className="mt-3 space-y-2 text-mist-400">
          <li>Crew: never say the word, and don&apos;t make your clue so obvious that the Imposter learns it.</li>
          <li>Imposter: repeat the vibe of earlier clues, stay confident, and point the suspicion elsewhere.</li>
          <li>Turn on &ldquo;Imposter sees the category&rdquo; in setup for an easier game with new players.</li>
        </ul>
      </section>

      <div className="mt-10 flex flex-col gap-3">
        <ButtonLink href="/setup">Set up a game</ButtonLink>
        <ButtonLink href="/" variant="ghost" size="md">
          Back to home
        </ButtonLink>
      </div>
    </Screen>
  );
}
