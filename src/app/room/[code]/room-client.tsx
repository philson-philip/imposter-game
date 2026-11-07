"use client";

import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Mark } from "@/components/mark";
import { RoundSetup, categoryLabel } from "@/components/room/round-setup";
import { Scoreboard } from "@/components/room/scoreboard";
import { WordText, YourCard } from "@/components/room/word-card";
import { Screen, Spotlight } from "@/components/shell";
import { Button, ButtonLink, Eyebrow } from "@/components/ui";
import { useHydrated, useWakeLock } from "@/lib/hooks";
import { loadLastName, roomUrl, shareRoom } from "@/lib/room-client";
import { ROOM, isValidCode, normalizeCode } from "@/lib/room-logic";
import type { PlayerView, RoomAction, RoomView, RoundView, TallyRow } from "@/lib/room-types";
import { useRoom } from "@/lib/use-room";

type Act = (action: RoomAction) => Promise<boolean>;

export function RoomClient() {
  const params = useParams<{ code: string }>();
  const code = normalizeCode(String(params?.code ?? ""));
  const hydrated = useHydrated();
  if (!hydrated) return <Screen aria-busy="true" />;
  if (!isValidCode(code)) {
    return <Gone title="That's not a room code" body="Room codes are five letters or digits, like KX7P2." />;
  }
  return <RoomScreen code={code} />;
}

function RoomScreen({ code }: { code: string }) {
  const room = useRoom(code);
  useWakeLock();

  if (room.state === "gone") {
    return <Gone title="Room not found" body={`Room ${code} doesn't exist or has expired. Rooms last about 12 hours.`} />;
  }
  if (room.state === "join") {
    return <JoinForm code={code} busy={room.busy} error={room.error} onJoin={room.join} />;
  }
  if (room.state === "loading" || !room.view) {
    return (
      <Screen aria-busy="true" className="items-center justify-center">
        <Mark className="h-16 w-16 animate-pulse" />
        <p className="mt-4 text-mist-400">Joining room {code}…</p>
      </Screen>
    );
  }
  return <Game view={room.view} act={room.act} busy={room.busy} error={room.error} offline={room.offline} />;
}

/* ---------- framing ---------- */

function Gone({ title, body }: { title: string; body: string }) {
  return (
    <Screen className="items-center justify-center text-center">
      <Mark className="h-20 w-20 opacity-80" />
      <h1 className="mt-6 text-3xl font-extrabold text-white">{title}</h1>
      <p className="mt-2 max-w-xs text-mist-400">{body}</p>
      <div className="mt-8 flex w-full flex-col gap-3">
        <ButtonLink href="/join">Join a different room</ButtonLink>
        <ButtonLink href="/" variant="ghost" size="md">
          Home
        </ButtonLink>
      </div>
    </Screen>
  );
}

function JoinForm({
  code,
  busy,
  error,
  onJoin,
}: {
  code: string;
  busy: boolean;
  error: string | null;
  onJoin: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(() => loadLastName());
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) void onJoin(name.trim());
  };
  return (
    <Screen className="justify-center">
      <Spotlight />
      <Mark className="mx-auto h-20 w-20 animate-rise" />
      <Eyebrow>Joining room</Eyebrow>
      <p className="mt-1 text-center font-mono text-4xl font-bold tracking-[0.2em] text-white">{code}</p>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-mist-300">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={ROOM.nameMax}
            autoFocus
            autoComplete="nickname"
            autoCapitalize="words"
            enterKeyHint="go"
            placeholder="What should we call you?"
            className="mt-1 h-13 w-full rounded-2xl border border-ink-700 bg-ink-800 px-4 text-lg text-white placeholder:text-mist-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold text-rose-300">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? "Joining…" : "Join game"}
        </Button>
        <ButtonLink href="/" variant="ghost" size="md" className="w-full">
          Home
        </ButtonLink>
      </form>
    </Screen>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div role="alert" className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-5">
      <p className="rounded-2xl border border-rose-500/40 bg-ink-900/95 px-4 py-3 text-sm font-semibold text-rose-200 shadow-xl animate-rise">{message}</p>
    </div>
  );
}

function Banner({ tone = "violet", children }: { tone?: "violet" | "rose" | "green" | "neutral"; children: React.ReactNode }) {
  const tones = {
    violet: "border-violet-500/40 bg-violet-500/10 text-violet-200",
    rose: "border-rose-500/40 bg-rose-500/10 text-rose-200",
    green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    neutral: "border-ink-700 bg-ink-800 text-mist-300",
  } as const;
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold leading-snug ${tones[tone]}`}>{children}</div>;
}

/* ---------- the game ---------- */

function Game({
  view,
  act,
  busy,
  error,
  offline,
}: {
  view: RoomView;
  act: Act;
  busy: boolean;
  error: string | null;
  offline: boolean;
}) {
  const isHost = view.hostId === view.youId;
  const host = view.players.find((p) => p.id === view.hostId) ?? null;
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const indexOf = (id: string) => Math.max(0, view.players.findIndex((p) => p.id === id));
  const nameOf = (id: string | null) => (id ? (view.players.find((p) => p.id === id)?.name ?? "Someone") : "Nobody");

  const share = async () => {
    const result = await shareRoom(view.code);
    if (result === "copied") {
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2000);
    }
  };

  return (
    <Screen>
      <header className="flex items-center justify-between gap-3 pt-1">
        <button type="button" onClick={share} className="flex items-center gap-2 rounded-xl py-1 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
          <Mark className="h-9 w-9" />
          <span>
            <span className="block text-[11px] font-semibold uppercase tracking-widest text-mist-500">Room</span>
            <span className="block font-mono text-lg font-bold leading-none tracking-[0.15em] text-white">{view.code}</span>
          </span>
        </button>
        <div className="flex items-center gap-1">
          <span className="hidden text-sm text-mist-400 sm:inline">{nameOf(view.youId)}</span>
          <Button variant="ghost" size="sm" onClick={() => setConfirmLeave(true)}>
            Leave
          </Button>
        </div>
      </header>

      {offline && (
        <div className="mt-3">
          <Banner tone="neutral">Reconnecting…</Banner>
        </div>
      )}

      {view.status === "ended" ? (
        <Ended view={view} act={act} busy={busy} isHost={isHost} host={host} />
      ) : !view.round ? (
        <Lobby view={view} act={act} busy={busy} isHost={isHost} host={host} share={share} shareState={shareState} indexOf={indexOf} />
      ) : (
        <Round view={view} round={view.round} act={act} busy={busy} isHost={isHost} host={host} nameOf={nameOf} indexOf={indexOf} />
      )}

      {error && <Toast message={error} />}

      {confirmLeave && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <div className="w-full max-w-md rounded-3xl border border-ink-700 bg-ink-900 p-5 animate-rise">
            <h2 id="leave-title" className="text-xl font-bold text-white">
              Leave this room?
            </h2>
            <p className="mt-1 text-mist-400">
              {isHost && view.players.length > 1 ? "Someone else will become the host. " : ""}
              You can rejoin with the code, but your points start again.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button variant="danger" onClick={() => void act({ type: "leave" })} disabled={busy}>
                Leave room
              </Button>
              <Button variant="secondary" onClick={() => setConfirmLeave(false)} autoFocus>
                Stay
              </Button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

/* ---------- lobby ---------- */

function Lobby({
  view,
  act,
  busy,
  isHost,
  host,
  share,
  shareState,
  indexOf,
}: {
  view: RoomView;
  act: Act;
  busy: boolean;
  isHost: boolean;
  host: PlayerView | null;
  share: () => Promise<void>;
  shareState: "idle" | "copied";
  indexOf: (id: string) => number;
}) {
  // Rendered only after hydration, so the window origin is available.
  const url = roomUrl(view.code);
  const missing = Math.max(0, ROOM.minPlayers - view.players.length);
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(view.code);
    } catch {
      // clipboard may be unavailable
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <section className="mt-6 text-center">
        <Spotlight />
        <Eyebrow>Room code</Eyebrow>
        <button
          type="button"
          onClick={share}
          className="mt-2 font-mono text-5xl font-bold tracking-[0.25em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label={`Room code ${view.code}. Tap to share`}
        >
          {view.code}
        </button>
        <p className="mt-3 text-sm text-mist-400">
          Friends can join at <span className="break-all font-medium text-mist-200">{url.replace(/^https?:\/\//, "")}</span>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" size="md" onClick={share}>
            {shareState === "copied" ? "Link copied ✓" : "Share invite"}
          </Button>
          <Button variant="secondary" size="md" onClick={copyCode}>
            Copy code
          </Button>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-mist-500">Players</h2>
          <span className="text-sm text-mist-400">
            {view.players.length} of {ROOM.maxPlayers}
          </span>
        </div>
        <PlayerList view={view} indexOf={indexOf} canKick={isHost} onKick={(id) => void act({ type: "kick", playerId: id })} />
        {view.roundsPlayed > 0 && (
          <p className="mt-2 text-sm text-mist-500">
            {view.roundsPlayed} round{view.roundsPlayed === 1 ? "" : "s"} played so far. Scores carry on.
          </p>
        )}
      </section>

      {isHost ? (
        <section className="mt-8 space-y-6">
          <RoundSetup settings={view.settings} onChange={(patch) => void act({ type: "setSettings", settings: patch })} />
          <Button onClick={() => void act({ type: "startRound" })} disabled={busy || missing > 0}>
            {missing > 0
              ? `Waiting for ${missing} more player${missing === 1 ? "" : "s"}`
              : `Start round ${view.roundsPlayed + 1}`}
          </Button>
        </section>
      ) : (
        <WaitingForHost view={view} host={host} act={act} busy={busy} />
      )}
    </div>
  );
}

function PlayerList({
  view,
  indexOf,
  canKick,
  onKick,
}: {
  view: RoomView;
  indexOf: (id: string) => number;
  canKick: boolean;
  onKick: (id: string) => void;
}) {
  return (
    <ul className="mt-3 divide-y divide-ink-700 border-y border-ink-700">
      {view.players.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          <Avatar name={p.name} index={indexOf(p.id)} size="sm" />
          <span className="min-w-0 flex-1 truncate font-semibold text-mist-200">
            {p.name}
            {p.id === view.youId && <span className="ml-1 text-xs font-medium text-mist-500">(you)</span>}
            {p.isHost && <span className="ml-2 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-300">host</span>}
          </span>
          <span
            className={`h-2.5 w-2.5 rounded-full ${p.online ? "bg-emerald-400" : "bg-ink-600"}`}
            role="img"
            aria-label={p.online ? "online" : "away"}
          />
          {canKick && !p.isHost && (
            <button
              type="button"
              onClick={() => onKick(p.id)}
              aria-label={`Remove ${p.name}`}
              className="rounded-lg px-2 py-1 text-sm text-mist-500 hover:bg-ink-800 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function WaitingForHost({ view, host, act, busy }: { view: RoomView; host: PlayerView | null; act: Act; busy: boolean }) {
  return (
    <section className="mt-8 rounded-3xl border border-ink-700 bg-ink-800 p-5 text-center">
      <p className="text-lg font-semibold text-white">Waiting for {host?.name ?? "the host"} to start…</p>
      <p className="mt-2 text-sm text-mist-400">
        Category: <span className="text-mist-200">{categoryLabel(view.settings.categoryIds)}</span>
        {" · "}
        {view.settings.imposterHint ? "Imposter sees the category" : "Imposter sees nothing"}
        {" · "}
        {view.settings.clueMode === "typed" ? "typed clues" : "spoken clues"}
      </p>
      {view.canClaimHost && (
        <Button variant="secondary" size="md" className="mt-4" onClick={() => void act({ type: "claimHost" })} disabled={busy}>
          Host seems to be away — take over
        </Button>
      )}
    </section>
  );
}

/* ---------- rounds ---------- */

function RoundHeader({ round, status }: { round: RoundView; status: string }) {
  return (
    <div className="mt-5 flex items-end justify-between gap-3">
      <div>
        <Eyebrow>
          <span className="block text-left">Round {round.number} · Clue cycle {round.cycle}</span>
        </Eyebrow>
        <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-white">{status}</h2>
      </div>
      {round.category ? (
        <span className="rounded-full bg-ink-800 px-3 py-1 text-xs font-semibold text-mist-300">
          {round.category.emoji} {round.category.en}
        </span>
      ) : (
        <span className="rounded-full bg-ink-800 px-3 py-1 text-xs font-semibold text-mist-500">🤫 category hidden</span>
      )}
    </div>
  );
}

function Round({
  view,
  round,
  act,
  busy,
  isHost,
  host,
  nameOf,
  indexOf,
}: {
  view: RoomView;
  round: RoundView;
  act: Act;
  busy: boolean;
  isHost: boolean;
  host: PlayerView | null;
  nameOf: (id: string | null) => string;
  indexOf: (id: string) => number;
}) {
  const you = round.you;
  const mode = view.settings.wordDisplay;
  const card = you.isParticipant ? (
    <div className="mt-4">
      <YourCard isImposter={you.isImposter} word={you.word} category={you.category} mode={mode} />
    </div>
  ) : (
    <div className="mt-4">
      <Banner tone="neutral">{you.isEliminated ? "You were voted out. Watch this round; you'll play again next round." : "You joined mid-round, so you're watching this one. You'll play from the next round."}</Banner>
    </div>
  );

  switch (round.phase) {
    case "clues":
      return (
        <div className="flex flex-1 flex-col">
          <RoundHeader round={round} status="Give your clues" />
          {card}
          <CluesPhase view={view} round={round} act={act} busy={busy} isHost={isHost} nameOf={nameOf} indexOf={indexOf} />
        </div>
      );
    case "vote":
      return (
        <div className="flex flex-1 flex-col">
          <RoundHeader round={round} status="Who is the Imposter?" />
          {card}
          <VotePhase view={view} round={round} act={act} busy={busy} isHost={isHost} nameOf={nameOf} indexOf={indexOf} />
        </div>
      );
    case "decision":
      return (
        <section className="mt-5 flex flex-1 flex-col gap-5">
          <RoundHeader round={round} status="The imposter is still hidden" />
          <p className="text-mist-300">
            {round.eliminatedId ? `${nameOf(round.eliminatedId)} was innocent and will sit out until the next round.` : "Nobody was voted out."}
          </p>
          <p className="text-sm text-mist-400">Clue cycle {round.cycle}. The word and imposter stay the same. No points have been awarded yet.</p>
          {round.tally && <Tally rows={round.tally} nameOf={nameOf} indexOf={indexOf} imposterId={null} />}
          {isHost ? (
            <div className="mt-4 flex flex-col gap-3">
              <Button onClick={() => void act({ type: "continueRound" })} disabled={busy || round.playerIds.length < 2}>
                Continue with more clues
              </Button>
              {round.playerIds.length < 2 && <p className="text-sm text-mist-400">Not enough players remain for another vote. End this round.</p>}
              <Button variant="secondary" onClick={() => void act({ type: "endRound" })} disabled={busy}>
                End round — imposter wins
              </Button>
              <Button variant="ghost" onClick={() => void act({ type: "endGame" })} disabled={busy}>
                End game and show final standings
              </Button>
            </div>
          ) : <p className="text-mist-400">Waiting for {host?.name ?? "the host"} to continue or end this round.</p>}
        </section>
      );
    case "guess":
      return (
        <div className="flex flex-1 flex-col">
          <RoundHeader round={round} status="Imposter caught!" />
          <GuessPhase view={view} round={round} act={act} busy={busy} isHost={isHost} nameOf={nameOf} indexOf={indexOf} />
        </div>
      );
    case "reveal":
      return (
        <div className="flex flex-1 flex-col">
          <RevealPhase view={view} round={round} act={act} busy={busy} isHost={isHost} host={host} nameOf={nameOf} indexOf={indexOf} />
        </div>
      );
  }
}

function ClueList({
  view,
  round,
  nameOf,
  indexOf,
  compact = false,
}: {
  view: RoomView;
  round: RoundView;
  nameOf: (id: string | null) => string;
  indexOf: (id: string) => number;
  compact?: boolean;
}) {
  const typed = view.settings.clueMode === "typed";
  return (
    <ol className="mt-3 divide-y divide-ink-700 border-y border-ink-700">
      {round.playerIds.map((id, i) => {
        const clue = round.clues.find((c) => c.playerId === id);
        const isTurn = round.turnId === id;
        return (
          <li key={id} className={`flex items-center gap-3 ${compact ? "py-1.5" : "py-2.5"} ${isTurn ? "-mx-2 rounded-xl bg-violet-500/10 px-2" : ""}`}>
            <span className="w-4 font-mono text-xs text-mist-500">{i + 1}</span>
            <Avatar name={nameOf(id)} index={indexOf(id)} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-mist-200">
                {nameOf(id)}
                {id === view.youId && <span className="ml-1 text-xs font-medium text-mist-500">(you)</span>}
              </p>
              {clue ? (
                <p className={`truncate ${clue.skipped ? "text-sm italic text-mist-500" : "text-base text-violet-200"}`}>
                  {clue.skipped ? (typed ? "skipped" : "spoke") : clue.text}
                </p>
              ) : isTurn ? (
                <p className="text-sm text-mist-400">{typed ? "typing a clue…" : "their turn to speak"}</p>
              ) : null}
            </div>
            {isTurn && <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-300">now</span>}
          </li>
        );
      })}
    </ol>
  );
}

function CluesPhase({
  view,
  round,
  act,
  busy,
  isHost,
  nameOf,
  indexOf,
}: {
  view: RoomView;
  round: RoundView;
  act: Act;
  busy: boolean;
  isHost: boolean;
  nameOf: (id: string | null) => string;
  indexOf: (id: string) => number;
}) {
  const typed = view.settings.clueMode === "typed";
  const yourTurn = round.turnId === view.youId;
  const [text, setText] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (await act({ type: "submitClue", text: text.trim() })) setText("");
  };

  return (
    <section className="mt-6 flex flex-1 flex-col">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-mist-500">Clues, in this order</h3>
        <span className="text-sm text-mist-400">
          {round.clues.length}/{round.playerIds.length}
        </span>
      </div>
      <ClueList view={view} round={round} nameOf={nameOf} indexOf={indexOf} />

      <div className="mt-5 space-y-3">
        {typed ? (
          yourTurn ? (
            <form onSubmit={submit} className="space-y-2">
              <label className="block text-sm font-semibold text-violet-200">Your turn. One word or a short phrase.</label>
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={ROOM.clueMax}
                  autoFocus
                  autoComplete="off"
                  enterKeyHint="send"
                  placeholder={round.you.isImposter ? "Bluff confidently…" : "Don't say the word…"}
                  className="h-12 min-w-0 flex-1 rounded-2xl border border-violet-500/50 bg-ink-800 px-4 text-base text-white placeholder:text-mist-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
                <Button type="submit" size="md" disabled={busy || !text.trim()}>
                  Send
                </Button>
              </div>
            </form>
          ) : round.turnId ? (
            <p className="text-center text-mist-400">
              Waiting for <span className="font-semibold text-mist-200">{nameOf(round.turnId)}</span> to type a clue…
            </p>
          ) : null
        ) : (
          <p className="text-center text-mist-400">Say your clue out loud when it&apos;s your turn.</p>
        )}

        {isHost && (
          <div className="flex flex-col gap-2 pt-2">
            {typed && round.turnId && round.turnId !== view.youId && (
              <Button variant="ghost" size="md" onClick={() => void act({ type: "skipTurn" })} disabled={busy}>
                Skip {nameOf(round.turnId)}
              </Button>
            )}
            {!typed && round.turnId && (
              <Button variant="secondary" size="md" onClick={() => void act({ type: "skipTurn" })} disabled={busy}>
                {nameOf(round.turnId)} has spoken, next
              </Button>
            )}
            <Button variant={typed ? "secondary" : "primary"} onClick={() => void act({ type: "startVoting" })} disabled={busy}>
              {typed ? "Start voting now" : "Everyone's done — start voting"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function VotePhase({
  view,
  round,
  act,
  busy,
  isHost,
  nameOf,
  indexOf,
}: {
  view: RoomView;
  round: RoundView;
  act: Act;
  busy: boolean;
  isHost: boolean;
  nameOf: (id: string | null) => string;
  indexOf: (id: string) => number;
}) {
  const you = round.you;
  const options = (round.candidates ?? round.playerIds).filter((id) => id !== view.youId);
  const remaining = round.votesNeeded - round.votesIn;

  return (
    <section className="mt-6 flex flex-1 flex-col">
      {round.revote && (
        <div className="mb-4">
          <Banner tone="violet">It&apos;s a tie between {round.candidates?.map((id) => nameOf(id)).join(" and ")}. Vote again.</Banner>
        </div>
      )}

      {you.isParticipant ? (
        <>
          <p className="text-sm font-semibold uppercase tracking-widest text-mist-500">{you.votedFor ? "Your vote (tap to change)" : "Tap a player to vote"}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {options.map((id) => {
              const picked = you.votedFor === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={picked}
                  disabled={busy}
                  onClick={() => void act({ type: "vote", targetId: id })}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                    picked ? "border-rose-500/60 bg-rose-500/15" : "border-ink-700 bg-ink-800 hover:border-ink-600"
                  }`}
                >
                  <Avatar name={nameOf(id)} index={indexOf(id)} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-mist-200">{nameOf(id)}</span>
                  {picked && <span aria-hidden>🗳️</span>}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <Banner tone="neutral">You&apos;re watching this vote.</Banner>
      )}

      <p className="mt-4 text-center text-sm text-mist-400">
        {round.votesIn}/{round.votesNeeded} votes in
        {remaining > 0 && you.votedFor ? ` · waiting for ${remaining} more` : ""}
      </p>

      {view.settings.clueMode === "typed" && round.clues.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-mist-400">Look at the clues again</summary>
          <ClueList view={view} round={round} nameOf={nameOf} indexOf={indexOf} compact />
        </details>
      )}

      {isHost && (
        <div className="mt-auto pt-6">
          <Button variant="secondary" onClick={() => void act({ type: "endVoting" })} disabled={busy}>
            End voting now
          </Button>
        </div>
      )}
    </section>
  );
}

function Tally({ rows, nameOf, indexOf, imposterId }: { rows: TallyRow[]; nameOf: (id: string | null) => string; indexOf: (id: string) => number; imposterId: string | null }) {
  if (rows.length === 0) return null;
  const max = rows[0]?.count ?? 1;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.playerId} className="flex items-center gap-3">
          <Avatar name={nameOf(r.playerId)} index={indexOf(r.playerId)} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold text-mist-200">
                {nameOf(r.playerId)}
                {r.playerId === imposterId && <span className="ml-2 text-xs font-semibold text-rose-300">Imposter</span>}
              </span>
              <span className="font-mono text-sm text-mist-400">
                {r.count} vote{r.count === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
              <div className="h-full rounded-full bg-rose-500" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
            <p className="mt-0.5 truncate text-xs text-mist-500">from {r.voters.map((v) => nameOf(v)).join(", ")}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function GuessPhase({
  view,
  round,
  act,
  busy,
  isHost,
  nameOf,
  indexOf,
}: {
  view: RoomView;
  round: RoundView;
  act: Act;
  busy: boolean;
  isHost: boolean;
  nameOf: (id: string | null) => string;
  indexOf: (id: string) => number;
}) {
  const you = round.you;
  return (
    <section className="mt-5 flex flex-1 flex-col space-y-5">
      <Banner tone="green">
        {nameOf(round.eliminatedId)} was voted out, and they were the Imposter. One last chance: can they guess the word?
      </Banner>
      {round.tally && <Tally rows={round.tally} nameOf={nameOf} indexOf={indexOf} imposterId={round.eliminatedId} />}

      {you.isImposter && you.guessOptions ? (
        <div>
          <h3 className="text-lg font-bold text-white">Which word did everyone have?</h3>
          <p className="text-sm text-mist-400">Guess right and you still take 2 points.</p>
          <div className="mt-3 grid gap-2">
            {you.guessOptions.map((w, i) => (
              <button
                key={`${w.ml}-${i}`}
                type="button"
                disabled={busy}
                onClick={() => void act({ type: "guess", index: i })}
                className="rounded-2xl border border-rose-500/40 bg-ink-800 px-4 py-2 text-left transition hover:border-rose-400 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <WordText word={w} mode={view.settings.wordDisplay} compact />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-mist-400">
          Waiting for <span className="font-semibold text-mist-200">{nameOf(round.eliminatedId)}</span> to guess…
        </p>
      )}

      {isHost && !you.isImposter && (
        <div className="mt-auto pt-2">
          <Button variant="ghost" size="md" className="w-full" onClick={() => void act({ type: "skipGuess" })} disabled={busy}>
            Skip the guess
          </Button>
        </div>
      )}
    </section>
  );
}

function RevealPhase({
  view,
  round,
  act,
  busy,
  isHost,
  host,
  nameOf,
  indexOf,
}: {
  view: RoomView;
  round: RoundView;
  act: Act;
  busy: boolean;
  isHost: boolean;
  host: PlayerView | null;
  nameOf: (id: string | null) => string;
  indexOf: (id: string) => number;
}) {
  const caught = round.eliminatedId !== null && round.eliminatedId === round.imposterId;
  const imposter = nameOf(round.imposterId);
  const headline = round.aborted ? "Round cancelled" : caught ? "Imposter caught!" : "The Imposter got away";
  const tone = round.aborted ? "neutral" : caught ? "green" : "rose";
  const detail = round.aborted
    ? "The Imposter left the game, so this round doesn't count."
    : caught
      ? `${imposter} was the Imposter${round.guessedWord ? " and still guessed the word. +2 for the bluff." : round.guessedWord === false ? " and couldn't guess the word." : "."}`
      : round.noElimination
        ? `Nobody was voted out. ${imposter} was the Imposter all along.`
        : `${nameOf(round.eliminatedId)} was innocent. ${imposter} was the Imposter.`;

  return (
    <section className="flex flex-1 flex-col">
      <div className="mt-5">
        <Spotlight tone={tone === "neutral" ? "violet" : tone === "green" ? "green" : "rose"} />
        <Eyebrow>
          <span className="block text-left">Round {round.number}</span>
        </Eyebrow>
        <h2 className="mt-0.5 text-3xl font-extrabold tracking-tight text-white animate-rise">{headline}</h2>
        <p className="mt-2 text-mist-300 animate-rise [animation-delay:80ms]">{detail}</p>
      </div>

      {round.word && (
        <div className="mt-5 rounded-3xl border border-ink-700 bg-ink-800 p-4 animate-rise [animation-delay:160ms]">
          <Eyebrow>The word was</Eyebrow>
          <WordText word={round.word} mode="both" />
          {round.category && (
            <p className="text-center text-sm text-mist-400">
              {round.category.emoji} {round.category.en}
            </p>
          )}
        </div>
      )}

      {round.tally && round.tally.length > 0 && (
        <div className="mt-6 animate-rise [animation-delay:240ms]">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-mist-500">Votes</h3>
          <Tally rows={round.tally} nameOf={nameOf} indexOf={indexOf} imposterId={round.imposterId} />
        </div>
      )}

      <div className="mt-6 animate-rise [animation-delay:320ms]">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-mist-500">Scores</h3>
        <Scoreboard players={view.players} deltas={round.deltas} youId={view.youId} imposterId={round.imposterId} />
      </div>

      {isHost ? (
        <div className="mt-8 space-y-4">
          <details className="rounded-2xl border border-ink-700 bg-ink-800 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-mist-200">
              Next round: {categoryLabel(view.settings.categoryIds)} <span className="text-mist-500">· change</span>
            </summary>
            <div className="mt-4">
              <RoundSetup settings={view.settings} onChange={(patch) => void act({ type: "setSettings", settings: patch })} />
            </div>
          </details>
          <Button onClick={() => void act({ type: "startRound" })} disabled={busy || view.players.length < ROOM.minPlayers}>
            {view.players.length < ROOM.minPlayers ? "Need at least 3 players" : `Start round ${round.number + 1}`}
          </Button>
          <Button variant="ghost" size="md" className="w-full" onClick={() => void act({ type: "endGame" })} disabled={busy}>
            End game and show final standings
          </Button>
        </div>
      ) : (
        <p className="mt-8 text-center text-mist-400">
          Waiting for {host?.name ?? "the host"} to start round {round.number + 1}… Next category:{" "}
          <span className="text-mist-200">{categoryLabel(view.settings.categoryIds)}</span>
        </p>
      )}
    </section>
  );
}

function Ended({ view, act, busy, isHost, host }: { view: RoomView; act: Act; busy: boolean; isHost: boolean; host: PlayerView | null }) {
  const winner = [...view.players].sort((a, b) => b.score - a.score)[0];
  return (
    <section className="mt-6 flex flex-1 flex-col">
      <Spotlight />
      <Eyebrow>Game over</Eyebrow>
      <h2 className="mt-1 text-center text-3xl font-extrabold text-white animate-rise">
        {winner && winner.score > 0 ? `${winner.name} wins!` : "Thanks for playing"}
      </h2>
      <p className="mt-1 text-center text-mist-400">
        {view.roundsPlayed} round{view.roundsPlayed === 1 ? "" : "s"} played
      </p>
      <div className="mt-6">
        <Scoreboard players={view.players} youId={view.youId} />
      </div>
      <div className="mt-8 flex flex-col gap-2">
        {isHost ? (
          <Button onClick={() => void act({ type: "backToLobby", resetScores: true })} disabled={busy}>
            Play again with this group
          </Button>
        ) : (
          <p className="text-center text-sm text-mist-400">{host?.name ?? "The host"} can start a new game in this room.</p>
        )}
        <Button variant="secondary" onClick={() => void act({ type: "leave" })} disabled={busy}>
          Leave room
        </Button>
      </div>
    </section>
  );
}
