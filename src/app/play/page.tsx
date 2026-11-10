"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { SecretCard } from "@/components/secret-card";
import { Screen, Spotlight } from "@/components/shell";
import { Timer } from "@/components/timer";
import { Button, Eyebrow } from "@/components/ui";
import { VotingProgress } from "@/components/voting-progress";
import { categoryName, settingsDisplay, uiLanguage, wordParts } from "@/lib/content";
import { CATEGORIES, categoryOf } from "@/data/words";
import { SCORING, clueOrder, createRound, scoreRound, tallyVotes } from "@/lib/game";
import { useHydrated, useStoredRound, useStoredSession, useStoredSettings, useWakeLock } from "@/lib/hooks";
import { clearRound, loadRound, loadSession, saveRound, saveSession } from "@/lib/storage";
import type { Category, Round, Session, Settings } from "@/lib/types";

export default function PlayPage() {
  const hydrated = useHydrated();
  return hydrated ? <Play /> : <Screen aria-busy="true" />;
}

/** Storage is the source of truth: every write re-renders through useSyncExternalStore. */
function updateRound(patch: Partial<Round>): void {
  const current = loadRound();
  if (current) saveRound({ ...current, ...patch });
}

function updateSession(patch: Partial<Session>): void {
  const current = loadSession();
  if (current) saveSession({ ...current, ...patch });
}

function Play() {
  const router = useRouter();
  const settings = useStoredSettings();
  const session = useStoredSession();
  const round = useStoredRound();
  const [quitOpen, setQuitOpen] = useState(false);
  const leaving = useRef(false);
  useWakeLock();

  // Nothing to play (fresh visit, or the round was cleared) → back to setup.
  useEffect(() => {
    if (!leaving.current && (!round || !session)) router.replace("/setup");
  }, [round, session, router]);

  if (!round || !session) return <Screen aria-busy="true" />;

  const players = session.players;
  const category = categoryOf(round.categoryId);
  const showCategory = settings.imposterHint || round.phase === "reveal";

  const nextRound = () => {
    const current = loadSession();
    if (!current) return;
    const { round: r, usedWords } = createRound(settings, current, CATEGORIES, round.number + 1);
    updateSession({ usedWords });
    saveRound(r);
    window.scrollTo({ top: 0 });
  };
  const quit = () => {
    leaving.current = true;
    clearRound();
    router.push("/");
  };
  const newGame = () => {
    leaving.current = true;
    clearRound();
    router.push("/setup");
  };

  return (
    <Screen>
      <header className="flex items-center justify-between gap-3 pt-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-500">Round {round.number}</p>
          <p className="font-semibold text-white">{showCategory ? `${category.emoji} ${categoryName(category, settingsDisplay(settings))}` : "🤫 Category hidden"}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setQuitOpen(true)}>
          Quit
        </Button>
      </header>

      {round.phase === "peek" && (
        <PeekPhase
          round={round}
          players={players}
          settings={settings}
          category={category}
          onNext={() => {
            if (round.peekIndex + 1 >= players.length) updateRound({ phase: "clues" });
            else updateRound({ peekIndex: round.peekIndex + 1 });
          }}
        />
      )}
      {round.phase === "clues" && (
        <CluesPhase round={round} players={players} settings={settings} onVote={() => updateRound({ phase: "vote" })} />
      )}
      {round.phase === "vote" &&
        (settings.voteMode === "secret" ? (
          <BallotPhase round={round} players={players} settings={settings} />
        ) : (
          <VotePhase players={players} onVote={(voted) => updateRound({ voted, phase: "reveal" })} />
        ))}
      {round.phase === "reveal" && (
        <RevealPhase
          round={round}
          players={players}
          session={session}
          category={category}
          settings={settings}
          onNextRound={nextRound}
          onNewGame={newGame}
          onHome={quit}
        />
      )}

      {quitOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="quit-title">
          <div className="w-full max-w-md rounded-3xl border border-ink-700 bg-ink-900 p-5 animate-rise">
            <h2 id="quit-title" className="text-xl font-bold text-white">
              Quit this game?
            </h2>
            <p className="mt-1 text-mist-400">The scores for this session will be lost.</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button variant="danger" onClick={quit}>
                Quit
              </Button>
              <Button variant="secondary" onClick={() => setQuitOpen(false)} autoFocus>
                Keep playing
              </Button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

/* ---------- pass & peek ---------- */

function PeekPhase({
  round,
  players,
  settings,
  category,
  onNext,
}: {
  round: Round;
  players: string[];
  settings: Settings;
  category: Category;
  onNext: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);

  const player = players[round.peekIndex];
  const isLast = round.peekIndex === players.length - 1;
  const done = () => {
    setFlipped(false);
    setLeaving(true);
    timeout.current = setTimeout(() => {
      setLeaving(false);
      onNext();
    }, 420);
  };

  return (
    <section className="flex flex-1 flex-col">
      <div className="mt-6 text-center">
        <Eyebrow>
          Player {round.peekIndex + 1} of {players.length}
        </Eyebrow>
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
          {flipped ? `${player}, keep it secret` : `Pass the phone to ${player}`}
        </h2>
      </div>
      <div className="my-6 flex flex-1 items-center">
        <SecretCard
          key={round.peekIndex}
          player={player}
          flipped={flipped}
          onFlip={() => !leaving && setFlipped((f) => !f)}
          isImposter={round.peekIndex === round.imposter}
          word={round.word}
          category={category}
          mode={settingsDisplay(settings)}
          showHint={settings.imposterHint}
        />
      </div>
      {flipped ? (
        <Button onClick={done} disabled={leaving}>
          {isLast ? "Got it — start the round" : `Got it — pass to ${players[round.peekIndex + 1]}`}
        </Button>
      ) : (
        <p className="text-center text-mist-400">
          Only <span className="font-semibold text-mist-200">{player}</span> should look. Tap the card to reveal.
        </p>
      )}
    </section>
  );
}

/* ---------- clues ---------- */

function CluesPhase({ round, players, settings, onVote }: { round: Round; players: string[]; settings: Settings; onVote: () => void }) {
  const order = clueOrder(round.starter, players.length);
  return (
    <section className="flex flex-1 flex-col">
      <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">Give your clues</h2>
      <p className="mt-2 text-mist-400">One clue each, in this order. Don&apos;t say the word. Imposter, bluff like you know it.</p>
      {settings.timerSeconds > 0 && (
        <div className="mt-5">
          <Timer seconds={settings.timerSeconds} />
        </div>
      )}
      <ol className="mt-5 divide-y divide-ink-700 border-y border-ink-700">
        {order.map((p, i) => (
          <li key={p} className="flex items-center gap-3 py-2.5">
            <span className="w-5 font-mono text-sm text-mist-500">{i + 1}</span>
            <Avatar name={players[p]} index={p} size="sm" />
            <span className="flex-1 font-semibold text-mist-200">{players[p]}</span>
            {i === 0 && <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-300">starts</span>}
          </li>
        ))}
      </ol>
      <div className="mt-auto pt-6">
        <Button onClick={onVote}>Start voting</Button>
      </div>
    </section>
  );
}

/* ---------- group vote ---------- */

function VotePhase({ players, onVote }: { players: string[]; onVote: (voted: number | null) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <section className="flex flex-1 flex-col">
      <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">Who is the Imposter?</h2>
      <p className="mt-2 text-mist-400">Talk it out, then vote one player out.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {players.map((name, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={pick === i}
            onClick={() => setPick(i)}
            className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
              pick === i ? "border-rose-500/60 bg-rose-500/15" : "border-ink-700 bg-ink-800 hover:border-ink-600"
            }`}
          >
            <Avatar name={name} index={i} size="sm" />
            <span className="min-w-0 flex-1 truncate font-semibold text-mist-200">{name}</span>
          </button>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Button disabled={pick === null} onClick={() => pick !== null && onVote(pick)}>
          {pick === null ? "Pick a player" : `Vote out ${players[pick]}`}
        </Button>
        <Button variant="ghost" size="md" className="w-full" onClick={() => onVote(null)}>
          Can&apos;t decide — nobody is voted out
        </Button>
      </div>
    </section>
  );
}

/* ---------- secret ballot ---------- */

function BallotPhase({ round, players, settings }: { round: Round; players: string[]; settings: Settings }) {
  const votes = players.map((_, voter) => {
    const target = round.votes[voter];
    return Number.isInteger(target) && target !== null && target >= 0 && target < players.length && target !== voter ? target : null;
  });
  const votingPlayers = players.map((name, index) => ({ id: String(index), name, hasVoted: votes[index] !== null }));
  const progress = <VotingProgress players={votingPlayers} eligibleIds={votingPlayers.map((player) => player.id)} language={uiLanguage(settingsDisplay(settings))} className="mt-4" />;
  const voter = votes.findIndex((v) => v === null);
  const [showing, setShowing] = useState(false);

  if (voter === -1) {
    const { counts, eliminated, leaders } = tallyVotes(votes, players.length);
    const max = Math.max(1, ...counts);
    return (
      <section className="flex flex-1 flex-col">
        <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">The votes are in</h2>
        {progress}
        <ul className="mt-5 space-y-3">
          {players.map((name, i) => (
            <li key={i} className="flex items-center gap-3">
              <Avatar name={name} index={i} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate font-semibold text-mist-200">{name}</span>
                  <span className="font-mono text-mist-400">{counts[i]}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <div className={`h-full rounded-full ${eliminated === i ? "bg-rose-500" : "bg-violet-500"}`} style={{ width: `${(counts[i] / max) * 100}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-col gap-2 pt-6">
          {eliminated !== null ? (
            <Button onClick={() => updateRound({ voted: eliminated, phase: "reveal" })}>Vote out {players[eliminated]} — reveal</Button>
          ) : (
            <>
              <p className="text-center text-mist-300">
                {leaders.length >= 2 ? `It's a tie between ${leaders.map((l) => players[l]).join(" and ")}.` : "No votes were cast."}
              </p>
              <Button onClick={() => updateRound({ votes: players.map(() => null) })}>Vote again</Button>
              <Button variant="ghost" size="md" className="w-full" onClick={() => updateRound({ voted: null, phase: "reveal" })}>
                Nobody is voted out — reveal
              </Button>
            </>
          )}
        </div>
      </section>
    );
  }

  const name = players[voter];
  if (!showing) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <Eyebrow>
          Vote {voter + 1} of {players.length}
        </Eyebrow>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white">Pass the phone to {name}</h2>
        <p className="mt-2 text-mist-400">Everyone votes in private.</p>
        {progress}
        <div className="mt-8 w-full">
          <Button onClick={() => setShowing(true)}>I&apos;m {name} — show my ballot</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col">
      <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">{name}, who is the Imposter?</h2>
      {progress}
      <div className="mt-5 grid grid-cols-2 gap-3">
        {players.map((p, i) =>
          i === voter ? null : (
            <button
              key={i}
              type="button"
              onClick={() => {
                setShowing(false);
                updateRound({ votes: votes.map((v, j) => (j === voter ? i : v)) });
              }}
              className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-800 p-3 text-left transition hover:border-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <Avatar name={p} index={i} size="sm" />
              <span className="min-w-0 flex-1 truncate font-semibold text-mist-200">{p}</span>
            </button>
          ),
        )}
      </div>
    </section>
  );
}

/* ---------- reveal ---------- */

function RevealPhase({
  round,
  players,
  session,
  category,
  settings,
  onNextRound,
  onNewGame,
  onHome,
}: {
  round: Round;
  players: string[];
  session: Session;
  category: Category;
  settings: Settings;
  onNextRound: () => void;
  onNewGame: () => void;
  onHome: () => void;
}) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(() => (round.scored ? 3 : 0));
  const mode = settingsDisplay(settings);
  const { primary, primaryLang, secondary } = wordParts(round.word, mode, category.id);
  const caught = round.voted === round.imposter;
  const imposterName = players[round.imposter];
  const deltas = scoreRound(round, players.length);

  const goScores = () => {
    const current = loadRound();
    const currentSession = loadSession();
    if (current && currentSession && !current.scored) {
      const d = scoreRound(current, players.length);
      updateSession({ scores: currentSession.scores.map((s, i) => s + d[i]), roundsPlayed: currentSession.roundsPlayed + 1 });
      updateRound({ scored: true });
    }
    setStep(3);
  };

  if (step === 0) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <Eyebrow>The group voted out</Eyebrow>
        {round.voted === null ? (
          <h2 className="mt-3 text-4xl font-extrabold text-white animate-pop">Nobody</h2>
        ) : (
          <>
            <Avatar name={players[round.voted]} index={round.voted} size="xl" className="mt-4 animate-pop" />
            <h2 className="mt-4 text-4xl font-extrabold text-white animate-rise [animation-delay:120ms]">{players[round.voted]}</h2>
          </>
        )}
        <div className="mt-10 w-full">
          <Button onClick={() => setStep(1)}>Reveal the truth</Button>
        </div>
      </section>
    );
  }

  if (step === 1) {
    return (
      <section className="flex flex-1 flex-col">
        <Spotlight tone={caught ? "green" : "rose"} />
        <div className="mt-8 text-center">
          <h2 className={`text-4xl font-extrabold tracking-tight animate-pop ${caught ? "text-emerald-300" : "text-rose-300"}`}>
            {caught ? "Caught!" : "Fooled!"}
          </h2>
          <p className="mt-3 text-lg text-mist-300 animate-rise [animation-delay:150ms]">
            {caught ? (
              <>
                <span className="font-semibold text-white">{imposterName}</span> was the Imposter.
              </>
            ) : round.voted === null ? (
              <>
                Nobody was voted out. The Imposter was <span className="font-semibold text-white">{imposterName}</span>.
              </>
            ) : (
              <>
                <span className="font-semibold text-white">{players[round.voted]}</span> was innocent. The Imposter was{" "}
                <span className="font-semibold text-white">{imposterName}</span>.
              </>
            )}
          </p>
        </div>
        <div className="mt-8 rounded-3xl border border-ink-700 bg-ink-800 p-5 text-center animate-rise [animation-delay:300ms]">
          <Eyebrow>The word was</Eyebrow>
          <p lang={primaryLang} className="mt-3 text-4xl font-extrabold leading-[1.3] text-white [overflow-wrap:anywhere]">
            {primary}
          </p>
          {secondary && <p className="mt-1 text-xl font-medium text-violet-300">{secondary}</p>}
          <p className="mt-2 text-sm text-mist-400">
            {category.emoji} {categoryName(category, mode)}
          </p>
        </div>
        <div className="mt-auto pt-8">
          {caught ? <Button onClick={() => setStep(2)}>Imposter&apos;s last chance</Button> : <Button onClick={goScores}>See the scores</Button>}
        </div>
      </section>
    );
  }

  if (step === 2) {
    return (
      <section className="flex flex-1 flex-col">
        <Spotlight tone="rose" />
        <div className="mt-8 text-center">
          <Eyebrow>Last chance</Eyebrow>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white">{imposterName}, guess the word</h2>
          <p className="mt-3 text-mist-400">
            Say your guess out loud. Get it right and you still take {SCORING.imposterGuess} points.
          </p>
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-8">
          <Button
            onClick={() => {
              updateRound({ guessedWord: true });
              goScores();
            }}
          >
            Nailed it (+{SCORING.imposterGuess} for {imposterName})
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              updateRound({ guessedWord: false });
              goScores();
            }}
          >
            Nope, wrong word
          </Button>
        </div>
      </section>
    );
  }

  const ranking = players
    .map((name, i) => ({ name, i, score: session.scores[i] ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return (
    <section className="flex flex-1 flex-col">
      <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">Scores</h2>
      <p className="mt-1 text-mist-400">
        After {session.roundsPlayed} round{session.roundsPlayed === 1 ? "" : "s"}
        {settings.categoryIds.length === 0 ? " · all categories" : ""}
      </p>
      <ol className="mt-5 divide-y divide-ink-700 border-y border-ink-700">
        {ranking.map(({ name, i, score }, rank) => (
          <li key={i} className="flex items-center gap-3 py-2.5">
            <span className="w-5 font-mono text-sm text-mist-500">{rank + 1}</span>
            <Avatar name={name} index={i} size="sm" />
            <span className="min-w-0 flex-1 truncate font-semibold text-mist-200">
              {name}
              {i === round.imposter && <span className="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-300">Imposter</span>}
              {rank === 0 && score > 0 && <span className="ml-1">👑</span>}
            </span>
            {deltas[i] !== 0 && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-300">+{deltas[i]}</span>
            )}
            <span className="w-8 text-right font-mono text-lg font-semibold tabular-nums text-white">{score}</span>
          </li>
        ))}
      </ol>
      <div className="mt-auto flex flex-col gap-2 pt-8">
        <Button onClick={onNextRound}>Next round</Button>
        <Button variant="secondary" onClick={onNewGame}>
          New game
        </Button>
        <Button variant="ghost" size="md" className="w-full" onClick={onHome}>
          Home
        </Button>
      </div>
    </section>
  );
}
