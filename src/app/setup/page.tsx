"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Screen } from "@/components/shell";
import { Button, ButtonLink, Chip, Field, Segmented, Toggle } from "@/components/ui";
import { CATEGORIES } from "@/data/words";
import { categoryName, CONTENT_LABELS, settingsDisplay, uiLanguage } from "@/lib/content";
import { MAX_PLAYERS, MIN_PLAYERS, countWords, createRound, newSession, normalizePlayers, playersError } from "@/lib/game";
import { useHydrated } from "@/lib/hooks";
import { loadSettings, saveRound, saveSession, saveSettings } from "@/lib/storage";
import type { Settings, TimerSeconds, VoteMode, WordDisplay } from "@/lib/types";

export default function SetupPage() {
  const hydrated = useHydrated();
  return hydrated ? <SetupForm /> : <Screen aria-busy="true" />;
}

function SetupForm() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const focusIndex = useRef<number | null>(null);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (patch.wordDisplay !== undefined) saveSettings(next);
  };
  const mode = settingsDisplay(settings);
  const labels = CONTENT_LABELS[uiLanguage(mode)];

  useEffect(() => {
    if (focusIndex.current !== null) {
      inputs.current[focusIndex.current]?.focus();
      focusIndex.current = null;
    }
  }, [settings.players.length]);

  const setPlayer = (i: number, value: string) =>
    update({ players: settings.players.map((p, j) => (j === i ? value : p)) });

  const addPlayer = () => {
    if (settings.players.length >= MAX_PLAYERS) return;
    focusIndex.current = settings.players.length;
    update({ players: [...settings.players, ""] });
  };

  const removePlayer = (i: number) => update({ players: settings.players.filter((_, j) => j !== i) });

  const toggleCategory = (id: string) => {
    const ids = settings.categoryIds.includes(id)
      ? settings.categoryIds.filter((c) => c !== id)
      : [...settings.categoryIds, id];
    update({ categoryIds: ids.length === CATEGORIES.length ? [] : ids });
  };

  const names = normalizePlayers(settings.players);
  const wordsInPlay = countWords(CATEGORIES, settings.categoryIds);

  const start = () => {
    const problem = playersError(names);
    if (problem) {
      setError(problem);
      return;
    }
    if (wordsInPlay === 0) {
      setError(labels.noWords);
      return;
    }
    setStarting(true);
    const cleaned: Settings = { ...settings, players: names };
    const session = newSession(names);
    const { round, usedWords } = createRound(cleaned, session, CATEGORIES, 1);
    saveSettings(cleaned);
    saveSession({ ...session, usedWords });
    saveRound(round);
    router.push("/play");
  };

  return (
    <Screen>
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-500">New game</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">Set up</h1>
        </div>
        <ButtonLink href="/" variant="ghost" size="sm">
          Home
        </ButtonLink>
      </header>

      <div className="mt-8 space-y-10">
        <Field label="Players" hint={`${names.length} of ${MAX_PLAYERS}`}>
          <ul className="space-y-2">
            {settings.players.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  value={p}
                  onChange={(e) => setPlayer(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (i < settings.players.length - 1) inputs.current[i + 1]?.focus();
                    else addPlayer();
                  }}
                  placeholder={`Player ${i + 1}`}
                  aria-label={`Player ${i + 1} name`}
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint={i < settings.players.length - 1 ? "next" : "done"}
                  maxLength={24}
                  className="h-12 min-w-0 flex-1 rounded-2xl border border-ink-700 bg-ink-800 px-4 text-base text-white placeholder:text-mist-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
                <button
                  type="button"
                  onClick={() => removePlayer(i)}
                  disabled={settings.players.length <= 1}
                  aria-label={`Remove player ${i + 1}`}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-mist-500 transition hover:bg-ink-800 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-30"
                >
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M5 5l10 10M15 5L5 15" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="md"
            className="w-full"
            onClick={addPlayer}
            disabled={settings.players.length >= MAX_PLAYERS}
          >
            + Add player
          </Button>
          <p className="text-sm text-mist-500">Best with {MIN_PLAYERS} or more. Blank names are skipped.</p>
        </Field>

        <Field label="Categories" hint={`${wordsInPlay} words in play`}>
          <div className="flex flex-wrap gap-2">
            <Chip selected={settings.categoryIds.length === 0} onClick={() => update({ categoryIds: [] })}>
              ✨ {labels.everything}
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c.id} selected={settings.categoryIds.includes(c.id)} onClick={() => toggleCategory(c.id)}>
                <span aria-hidden>{c.emoji}</span> {categoryName(c, mode)}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Options">
          <div className="space-y-2">
            <Toggle
              checked={settings.imposterHint}
              onChange={(v) => update({ imposterHint: v })}
              label="Imposter sees the category"
              hint="Easier for the Imposter. Everyone else sees the category too."
            />
            <Segmented<WordDisplay>
              label="Word display"
              value={mode}
              onChange={(wordDisplay) => update({ wordDisplay, showEnglish: wordDisplay !== "ml" })}
              options={[
                { value: "both", label: "മലയാളം + English" },
                { value: "en", label: "English" },
                { value: "ml", label: "മലയാളം" },
              ]}
            />
          </div>
          <div className="space-y-2 pt-2">
            <p className="text-sm font-semibold text-mist-300">Discussion timer</p>
            <Segmented<TimerSeconds>
              label="Discussion timer"
              value={settings.timerSeconds}
              onChange={(v) => update({ timerSeconds: v })}
              options={[
                { value: 0, label: "Off" },
                { value: 60, label: "1:00" },
                { value: 120, label: "2:00" },
                { value: 180, label: "3:00" },
              ]}
            />
          </div>
          <div className="space-y-2 pt-2">
            <p className="text-sm font-semibold text-mist-300">Voting</p>
            <Segmented<VoteMode>
              label="Voting"
              value={settings.voteMode}
              onChange={(v) => update({ voteMode: v })}
              options={[
                { value: "group", label: "Group decides" },
                { value: "secret", label: "Secret ballot" },
              ]}
            />
            <p className="text-sm text-mist-500">
              {settings.voteMode === "group"
                ? "Talk it out, then tap the player you're voting out."
                : "Pass the phone around once more so everyone votes in private."}
            </p>
          </div>
        </Field>
      </div>

      <div className="sticky bottom-0 -mx-5 mt-10 border-t border-ink-700/60 bg-ink-950/90 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        {error && (
          <p role="alert" className="mb-3 text-center text-sm font-semibold text-rose-300 animate-shake">
            {error}
          </p>
        )}
        <Button onClick={start} disabled={starting}>
          {starting ? "Dealing cards…" : names.length >= MIN_PLAYERS ? `Start with ${names.length} players` : "Start game"}
        </Button>
      </div>
    </Screen>
  );
}
