import type { Word } from "./types";

export type RoomStatus = "lobby" | "playing" | "ended";
export type OnlinePhase = "clues" | "vote" | "decision" | "guess" | "reveal";
export type WordDisplay = "both" | "en" | "ml";
export type ClueMode = "typed" | "spoken";

export type RoomPlayer = {
  id: string;
  name: string;
  score: number;
  joinedAt: number;
  lastSeen: number;
  /** Secret; never leaves the server. */
  token: string;
};

export type Clue = { playerId: string; text: string; skipped: boolean };

export type OnlineRound = {
  number: number;
  cycle?: number;
  eliminatedIds?: string[];
  categoryIds: string[];
  categoryId: string;
  word: Word;
  imposterId: string;
  /** Participants in clue order, starter first. */
  playerIds: string[];
  phase: OnlinePhase;
  clues: Clue[];
  /** voterId -> targetId */
  votes: Record<string, string>;
  revote: boolean;
  candidates: string[] | null;
  eliminatedId: string | null;
  noElimination: boolean;
  /** The imposter left mid-round; no points awarded. */
  aborted: boolean;
  guessOptions: Word[] | null;
  guessIndex: number | null;
  guessedWord: boolean | null;
  deltas: Record<string, number>;
  startedAt: number;
  phaseAt: number;
};

export type RoomSettings = {
  /** Default categories for the next round; empty = everything. */
  categoryIds: string[];
  imposterHint: boolean;
  wordDisplay: WordDisplay;
  clueMode: ClueMode;
};

export type Room = {
  code: string;
  /** Bumped on every game-relevant change; clients poll against it. */
  version: number;
  /** Bumped on every write, including presence; used for compare-and-set. */
  rev: number;
  hostId: string;
  status: RoomStatus;
  players: RoomPlayer[];
  settings: RoomSettings;
  round: OnlineRound | null;
  roundsPlayed: number;
  usedWords: string[];
  createdAt: number;
  updatedAt: number;
};

export type RoomAction =
  | { type: "setSettings"; settings: Partial<RoomSettings> }
  | { type: "startRound"; categoryIds?: string[] }
  | { type: "submitClue"; text: string }
  | { type: "skipTurn" }
  | { type: "startVoting" }
  | { type: "vote"; targetId: string }
  | { type: "endVoting" }
  | { type: "continueRound" }
  | { type: "endRound" }
  | { type: "guess"; index: number }
  | { type: "skipGuess" }
  | { type: "endGame" }
  | { type: "backToLobby"; resetScores: boolean }
  | { type: "kick"; playerId: string }
  | { type: "leave" }
  | { type: "claimHost" };

/* ---------- What a single player is allowed to see ---------- */

export type CategoryInfo = { id: string; en: string; ml: string; emoji: string };

export type PlayerView = {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  online: boolean;
  inRound: boolean;
  hasClue: boolean;
  hasVoted: boolean;
};

export type TallyRow = { playerId: string; count: number; voters: string[] };

export type RoundView = {
  number: number;
  cycle: number;
  eliminatedIds: string[];
  phase: OnlinePhase;
  categoryIds: string[];
  /** Visible to everyone only when the imposter hint is on or the round is over. */
  category: CategoryInfo | null;
  playerIds: string[];
  turnId: string | null;
  clues: Clue[];
  votesIn: number;
  votesNeeded: number;
  revote: boolean;
  candidates: string[] | null;
  you: {
    isParticipant: boolean;
    isEliminated: boolean;
    isImposter: boolean;
    word: Word | null;
    category: CategoryInfo | null;
    votedFor: string | null;
    guessOptions: Word[] | null;
  };
  tally: TallyRow[] | null;
  eliminatedId: string | null;
  noElimination: boolean;
  aborted: boolean;
  guessedWord: boolean | null;
  guessIndex: number | null;
  /** Revealed to everyone once the round is over. */
  imposterId: string | null;
  word: Word | null;
  deltas: Record<string, number>;
};

export type RoomView = {
  code: string;
  version: number;
  status: RoomStatus;
  youId: string;
  hostId: string;
  players: PlayerView[];
  settings: RoomSettings;
  roundsPlayed: number;
  round: RoundView | null;
  canClaimHost: boolean;
  now: number;
};
