import { CATEGORIES, categoryOf } from "@/data/words";
import { SCORING, pickWord, randomInt, selectCategories, tallyVotes, wordKey } from "./game";
import type {
  CategoryInfo,
  OnlineRound,
  PlayerView,
  Room,
  RoomAction,
  RoomPlayer,
  RoomSettings,
  RoomView,
  TallyRow,
} from "./room-types";
import type { Category, Word } from "./types";

export const ROOM = {
  minPlayers: 3,
  maxPlayers: 20,
  codeLength: 5,
  ttlSeconds: 12 * 60 * 60,
  nameMax: 20,
  clueMax: 40,
  /** A player counts as online if seen within this window. */
  presenceMs: 35_000,
  /** Presence is persisted at most this often per player. */
  touchEveryMs: 15_000,
  /** Anyone can take over as host once the host has been silent this long. */
  hostClaimAfterMs: 45_000,
  guessOptionCount: 5,
} as const;

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  categoryIds: [],
  imposterHint: false,
  wordDisplay: "both",
  clueMode: "typed",
};

export class RoomError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "RoomError";
  }
}

type Deps = { categories?: Category[]; random?: (n: number) => number };

/* ---------- ids ---------- */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode(random: (n: number) => number = randomInt): string {
  let code = "";
  for (let i = 0; i < ROOM.codeLength; i++) code += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return code;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM.codeLength);
}

export function isValidCode(code: string): boolean {
  return code.length === ROOM.codeLength && [...code].every((c) => CODE_ALPHABET.includes(c));
}

export function makeId(length = 10): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < length; i++) id += alphabet[randomInt(alphabet.length)];
  return id;
}

export function makeToken(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- helpers ---------- */

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, ROOM.nameMax);
}

function uniqueName(room: Room, name: string): string {
  const taken = new Set(room.players.map((p) => p.name.toLocaleLowerCase()));
  if (!taken.has(name.toLocaleLowerCase())) return name;
  for (let i = 2; i < 100; i++) {
    const candidate = `${name} ${i}`.slice(0, ROOM.nameMax + 3);
    if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${name} ${makeId(3)}`;
}

function player(room: Room, id: string): RoomPlayer {
  const p = room.players.find((x) => x.id === id);
  if (!p) throw new RoomError(403, "You are not in this room.");
  return p;
}

function requireHost(room: Room, actorId: string): void {
  if (room.hostId !== actorId) throw new RoomError(403, "Only the host can do that.");
}

function requireRound(room: Room): OnlineRound {
  if (!room.round) throw new RoomError(409, "No round is running.");
  return room.round;
}

function shuffle<T>(items: T[], random: (n: number) => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function bump(room: Room, now: number): Room {
  return { ...room, version: room.version + 1, updatedAt: now };
}

/* ---------- lifecycle ---------- */

export function createRoom(code: string, hostName: string, now: number): { room: Room; player: RoomPlayer } {
  const name = cleanName(hostName);
  if (!name) throw new RoomError(400, "Enter your name.");
  const host: RoomPlayer = { id: makeId(), name, score: 0, joinedAt: now, lastSeen: now, token: makeToken() };
  const room: Room = {
    code,
    version: 1,
    rev: 0,
    hostId: host.id,
    status: "lobby",
    players: [host],
    settings: { ...DEFAULT_ROOM_SETTINGS },
    round: null,
    roundsPlayed: 0,
    usedWords: [],
    createdAt: now,
    updatedAt: now,
  };
  return { room, player: host };
}

export function joinRoom(room: Room, rawName: string, now: number): { room: Room; player: RoomPlayer } {
  const name = cleanName(rawName);
  if (!name) throw new RoomError(400, "Enter your name.");
  if (room.status === "ended") throw new RoomError(410, "This game has ended.");
  if (room.players.length >= ROOM.maxPlayers) throw new RoomError(409, `This room is full (${ROOM.maxPlayers} players).`);
  const p: RoomPlayer = {
    id: makeId(),
    name: uniqueName(room, name),
    score: 0,
    joinedAt: now,
    lastSeen: now,
    token: makeToken(),
  };
  return { room: bump({ ...room, players: [...room.players, p] }, now), player: p };
}

/** Records presence; returns null when nothing needs to be written. */
export function touch(room: Room, playerId: string, now: number): Room | null {
  const p = room.players.find((x) => x.id === playerId);
  if (!p || now - p.lastSeen < ROOM.touchEveryMs) return null;
  return { ...room, players: room.players.map((x) => (x.id === playerId ? { ...x, lastSeen: now } : x)) };
}

/* ---------- the reducer ---------- */

export function applyAction(room: Room, actorId: string, action: RoomAction, now: number, deps: Deps = {}): Room {
  const categories = deps.categories ?? CATEGORIES;
  const random = deps.random ?? randomInt;
  const actor = player(room, actorId);
  const next = reduce(room, actor, action, now, categories, random);
  return next === room ? room : bump({ ...next, players: next.players.map((p) => (p.id === actorId ? { ...p, lastSeen: now } : p)) }, now);
}

function reduce(
  room: Room,
  actor: RoomPlayer,
  action: RoomAction,
  now: number,
  categories: Category[],
  random: (n: number) => number,
): Room {
  switch (action.type) {
    case "setSettings": {
      requireHost(room, actor.id);
      return { ...room, settings: sanitizeSettings({ ...room.settings, ...action.settings }, categories) };
    }

    case "startRound": {
      requireHost(room, actor.id);
      if (room.status === "ended") throw new RoomError(409, "This game has ended.");
      if (room.round && room.round.phase !== "reveal") throw new RoomError(409, "A round is already running.");
      if (room.players.length < ROOM.minPlayers) throw new RoomError(409, `You need at least ${ROOM.minPlayers} players.`);
      const settings = sanitizeSettings(
        { ...room.settings, categoryIds: action.categoryIds ?? room.settings.categoryIds },
        categories,
      );
      const { word, categoryId, usedReset } = pickWord(categories, settings.categoryIds, room.usedWords);
      const inPlay = new Set(selectCategories(categories, settings.categoryIds).map((c) => c.id));
      const base = usedReset ? room.usedWords.filter((k) => !inPlay.has(k.slice(0, k.indexOf(":")))) : room.usedWords;
      const ids = room.players.map((p) => p.id);
      const starter = random(ids.length);
      const order = ids.map((_, i) => ids[(starter + i) % ids.length]);
      const round: OnlineRound = {
        number: room.roundsPlayed + 1,
        categoryIds: settings.categoryIds,
        categoryId,
        word,
        imposterId: ids[random(ids.length)],
        playerIds: order,
        phase: "clues",
        clues: [],
        votes: {},
        revote: false,
        candidates: null,
        eliminatedId: null,
        noElimination: false,
        aborted: false,
        guessOptions: null,
        guessIndex: null,
        guessedWord: null,
        deltas: {},
        startedAt: now,
        phaseAt: now,
      };
      return { ...room, status: "playing", settings, round, usedWords: [...base, wordKey(categoryId, word)] };
    }

    case "submitClue": {
      const round = requireRound(room);
      if (round.phase !== "clues") throw new RoomError(409, "Clues are over.");
      if (room.settings.clueMode !== "typed") throw new RoomError(409, "Clues are spoken in this room.");
      if (turnOf(round) !== actor.id) throw new RoomError(409, "It's not your turn.");
      const text = action.text.replace(/\s+/g, " ").trim().slice(0, ROOM.clueMax);
      if (!text) throw new RoomError(400, "Type a clue first.");
      return withRound(room, advanceClues({ ...round, clues: [...round.clues, { playerId: actor.id, text, skipped: false }] }, now));
    }

    case "skipTurn": {
      requireHost(room, actor.id);
      const round = requireRound(room);
      if (round.phase !== "clues") throw new RoomError(409, "Clues are over.");
      const turn = turnOf(round);
      if (!turn) return room;
      return withRound(room, advanceClues({ ...round, clues: [...round.clues, { playerId: turn, text: "", skipped: true }] }, now));
    }

    case "startVoting": {
      requireHost(room, actor.id);
      const round = requireRound(room);
      if (round.phase !== "clues") throw new RoomError(409, "Voting has already started.");
      return withRound(room, { ...round, phase: "vote", phaseAt: now });
    }

    case "vote": {
      const round = requireRound(room);
      if (round.phase !== "vote") throw new RoomError(409, "Voting isn't open.");
      if (!round.playerIds.includes(actor.id)) throw new RoomError(403, "You joined after this round started.");
      if (action.targetId === actor.id) throw new RoomError(400, "You can't vote for yourself.");
      if (!round.playerIds.includes(action.targetId)) throw new RoomError(400, "That player isn't in this round.");
      if (round.candidates && !round.candidates.includes(action.targetId)) throw new RoomError(400, "Pick one of the tied players.");
      const votes = { ...round.votes, [actor.id]: action.targetId };
      const updated = { ...round, votes };
      const everyoneVoted = round.playerIds.every((id) => id in votes);
      return withRound(room, everyoneVoted ? finishVoting(room, updated, now, categories, random) : updated);
    }

    case "endVoting": {
      requireHost(room, actor.id);
      const round = requireRound(room);
      if (round.phase !== "vote") throw new RoomError(409, "Voting isn't open.");
      return withRound(room, finishVoting(room, round, now, categories, random));
    }

    case "guess": {
      const round = requireRound(room);
      if (round.phase !== "guess") throw new RoomError(409, "There is nothing to guess right now.");
      if (actor.id !== round.imposterId) throw new RoomError(403, "Only the imposter can guess.");
      const options = round.guessOptions ?? [];
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= options.length) {
        throw new RoomError(400, "Pick one of the options.");
      }
      const picked = options[action.index];
      const correct = picked.ml === round.word.ml && picked.en === round.word.en;
      return withRound(room, reveal(room, { ...round, guessIndex: action.index, guessedWord: correct }, now));
    }

    case "skipGuess": {
      requireHost(room, actor.id);
      const round = requireRound(room);
      if (round.phase !== "guess") throw new RoomError(409, "There is nothing to skip.");
      return withRound(room, reveal(room, { ...round, guessedWord: false }, now));
    }

    case "endGame": {
      requireHost(room, actor.id);
      if (room.status === "ended") return room;
      const round = room.round && room.round.phase !== "reveal" ? { ...room.round, aborted: true, phase: "reveal" as const, phaseAt: now } : room.round;
      return { ...room, status: "ended", round };
    }

    case "backToLobby": {
      requireHost(room, actor.id);
      return {
        ...room,
        status: "lobby",
        round: null,
        roundsPlayed: action.resetScores ? 0 : room.roundsPlayed,
        usedWords: action.resetScores ? [] : room.usedWords,
        players: action.resetScores ? room.players.map((p) => ({ ...p, score: 0 })) : room.players,
      };
    }

    case "kick": {
      requireHost(room, actor.id);
      if (action.playerId === actor.id) throw new RoomError(400, "You can't remove yourself. Leave instead.");
      if (!room.players.some((p) => p.id === action.playerId)) return room;
      return removePlayer(room, action.playerId, now, categories, random);
    }

    case "leave": {
      return removePlayer(room, actor.id, now, categories, random);
    }

    case "claimHost": {
      if (room.hostId === actor.id) return room;
      const host = room.players.find((p) => p.id === room.hostId);
      if (host && now - host.lastSeen < ROOM.hostClaimAfterMs) {
        throw new RoomError(409, `${host.name} is still here. You can take over once they've been away for a while.`);
      }
      return { ...room, hostId: actor.id };
    }

    default: {
      const never: never = action;
      throw new RoomError(400, `Unknown action ${JSON.stringify(never)}`);
    }
  }
}

function sanitizeSettings(s: RoomSettings, categories: Category[]): RoomSettings {
  const known = new Set(categories.map((c) => c.id));
  const ids = Array.from(new Set((s.categoryIds ?? []).filter((id) => known.has(id))));
  return {
    categoryIds: ids.length === categories.length ? [] : ids,
    imposterHint: Boolean(s.imposterHint),
    wordDisplay: s.wordDisplay === "en" || s.wordDisplay === "ml" ? s.wordDisplay : "both",
    clueMode: s.clueMode === "spoken" ? "spoken" : "typed",
  };
}

export function turnOf(round: OnlineRound): string | null {
  if (round.phase !== "clues") return null;
  return round.playerIds[round.clues.length] ?? null;
}

function withRound(room: Room, round: OnlineRound): Room {
  return { ...room, round };
}

function advanceClues(round: OnlineRound, now: number): OnlineRound {
  if (round.clues.length >= round.playerIds.length) return { ...round, phase: "vote", phaseAt: now };
  return round;
}

function finishVoting(
  room: Room,
  round: OnlineRound,
  now: number,
  categories: Category[],
  random: (n: number) => number,
): OnlineRound {
  const ids = round.playerIds;
  const votes = ids.map((id) => {
    const target = round.votes[id];
    return target === undefined ? null : ids.indexOf(target);
  });
  const { leaders, eliminated } = tallyVotes(votes, ids.length);
  if (eliminated !== null) {
    const eliminatedId = ids[eliminated];
    if (eliminatedId === round.imposterId) {
      const category = categories.find((c) => c.id === round.categoryId) ?? categoryOf(round.categoryId);
      const decoys = shuffle(
        category.words.filter((w) => w.ml !== round.word.ml),
        random,
      ).slice(0, ROOM.guessOptionCount - 1);
      return {
        ...round,
        eliminatedId,
        phase: "guess",
        phaseAt: now,
        guessOptions: shuffle([round.word, ...decoys], random),
      };
    }
    return reveal(room, { ...round, eliminatedId }, now);
  }
  if (leaders.length >= 2 && !round.revote) {
    return { ...round, revote: true, candidates: leaders.map((i) => ids[i]), votes: {}, phaseAt: now };
  }
  return reveal(room, { ...round, noElimination: true }, now);
}

/** Closes the round: works out the points and marks it as revealed. Mutation-free; scores are applied by the caller through `settle`. */
function reveal(room: Room, round: OnlineRound, now: number): OnlineRound {
  const deltas: Record<string, number> = {};
  if (!round.aborted) {
    const caught = round.eliminatedId === round.imposterId;
    for (const id of round.playerIds) {
      if (caught) deltas[id] = id === round.imposterId ? (round.guessedWord ? SCORING.imposterGuess : 0) : SCORING.crewCatch;
      else deltas[id] = id === round.imposterId ? SCORING.imposterEscape : 0;
    }
  }
  return { ...round, phase: "reveal", phaseAt: now, deltas };
}

/** Applies a revealed round's deltas to the players exactly once. */
function settle(room: Room): Room {
  const round = room.round;
  if (!round || round.phase !== "reveal" || room.roundsPlayed >= round.number) return room;
  return {
    ...room,
    roundsPlayed: round.number,
    players: room.players.map((p) => ({ ...p, score: p.score + (round.deltas[p.id] ?? 0) })),
  };
}

function removePlayer(room: Room, playerId: string, now: number, categories: Category[], random: (n: number) => number): Room {
  const players = room.players.filter((p) => p.id !== playerId);
  let next: Room = { ...room, players };
  if (players.length === 0) return { ...next, round: null, status: "ended" };
  if (room.hostId === playerId) {
    const oldest = players.reduce((a, b) => (a.joinedAt <= b.joinedAt ? a : b));
    next = { ...next, hostId: oldest.id };
  }
  const round = room.round;
  if (!round || round.phase === "reveal" || !round.playerIds.includes(playerId)) return next;

  const playerIds = round.playerIds.filter((id) => id !== playerId);
  const votes = Object.fromEntries(Object.entries(round.votes).filter(([voter, target]) => voter !== playerId && target !== playerId));
  const candidates = round.candidates ? round.candidates.filter((id) => id !== playerId) : null;
  let updated: OnlineRound = { ...round, playerIds, votes, candidates };

  if (playerId === round.imposterId || playerIds.length < ROOM.minPlayers) {
    return withRound(next, { ...updated, aborted: true, phase: "reveal", phaseAt: now, deltas: {} });
  }
  if (updated.phase === "clues") {
    updated = { ...updated, clues: updated.clues.filter((c) => c.playerId !== playerId) };
    updated = advanceClues(updated, now);
  } else if (updated.phase === "vote") {
    if (candidates && candidates.length < 2) updated = { ...updated, candidates: null };
    if (playerIds.every((id) => id in votes)) updated = finishVoting(next, updated, now, categories, random);
  }
  return withRound(next, updated);
}

/** Post-processes any reducer result: applies scores for revealed rounds. */
export function finalize(room: Room): Room {
  return settle(room);
}

/* ---------- views ---------- */

function categoryInfo(id: string, categories: Category[]): CategoryInfo {
  const c = categories.find((x) => x.id === id) ?? categoryOf(id);
  return { id: c.id, en: c.en, ml: c.ml, emoji: c.emoji };
}

export function toView(room: Room, playerId: string, now: number, categories: Category[] = CATEGORIES): RoomView {
  const round = room.round;
  const host = room.players.find((p) => p.id === room.hostId);
  const players: PlayerView[] = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    isHost: p.id === room.hostId,
    online: now - p.lastSeen < ROOM.presenceMs,
    inRound: round ? round.playerIds.includes(p.id) : false,
    hasClue: round ? round.clues.some((c) => c.playerId === p.id) : false,
    hasVoted: round ? p.id in round.votes : false,
  }));

  let roundView: RoomView["round"] = null;
  if (round) {
    const over = round.phase === "reveal";
    const isImposter = round.imposterId === playerId;
    const isParticipant = round.playerIds.includes(playerId);
    const category = categoryInfo(round.categoryId, categories);
    const showsCategory = room.settings.imposterHint || over;
    const tally: TallyRow[] | null =
      round.phase === "guess" || over
        ? round.playerIds
            .map((id) => ({
              playerId: id,
              count: Object.values(round.votes).filter((t) => t === id).length,
              voters: Object.entries(round.votes)
                .filter(([, t]) => t === id)
                .map(([v]) => v),
            }))
            .filter((r) => r.count > 0)
            .sort((a, b) => b.count - a.count)
        : null;
    roundView = {
      number: round.number,
      phase: round.phase,
      categoryIds: round.categoryIds,
      category: showsCategory ? category : null,
      playerIds: round.playerIds,
      turnId: turnOf(round),
      clues: round.clues,
      votesIn: Object.keys(round.votes).length,
      votesNeeded: round.playerIds.length,
      revote: round.revote,
      candidates: round.candidates,
      you: {
        isParticipant,
        isImposter,
        word: isParticipant && !isImposter ? round.word : null,
        category: isParticipant && !isImposter ? category : showsCategory ? category : null,
        votedFor: round.votes[playerId] ?? null,
        guessOptions: isImposter && round.phase === "guess" ? round.guessOptions : null,
      },
      tally,
      eliminatedId: round.phase === "guess" || over ? round.eliminatedId : null,
      noElimination: over ? round.noElimination : false,
      aborted: round.aborted,
      guessedWord: over ? round.guessedWord : null,
      guessIndex: over ? round.guessIndex : null,
      imposterId: over ? round.imposterId : null,
      word: over ? round.word : null,
      deltas: over ? round.deltas : {},
    };
  }

  return {
    code: room.code,
    version: room.version,
    status: room.status,
    youId: playerId,
    hostId: room.hostId,
    players,
    settings: room.settings,
    roundsPlayed: room.roundsPlayed,
    round: roundView,
    canClaimHost: room.hostId !== playerId && (!host || now - host.lastSeen >= ROOM.hostClaimAfterMs),
    now,
  };
}

/** Decoy-safe helper for tests and UI: does the view's word match? */
export function sameWord(a: Word, b: Word): boolean {
  return a.ml === b.ml && a.en === b.en;
}
