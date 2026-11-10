export type Word = { id?: string; ml: string; en: string; transliteration?: string };
export type WordDisplay = "both" | "en" | "ml";

export type Category = {
  id: string;
  en: string;
  ml: string;
  emoji: string;
  words: Word[];
};

export type VoteMode = "group" | "secret";
export type TimerSeconds = 0 | 60 | 120 | 180;

export type Settings = {
  players: string[];
  /** Empty array means every category is in play. */
  categoryIds: string[];
  /** Show the imposter which category the word belongs to. */
  imposterHint: boolean;
  /** Legacy preference, used when loading settings saved before wordDisplay. */
  showEnglish: boolean;
  wordDisplay?: WordDisplay;
  timerSeconds: TimerSeconds;
  voteMode: VoteMode;
};

export type RoundPhase = "peek" | "clues" | "vote" | "reveal";

export type Round = {
  id: string;
  number: number;
  word: Word;
  categoryId: string;
  /** Player index of the imposter. */
  imposter: number;
  /** Player index who gives the first clue. */
  starter: number;
  phase: RoundPhase;
  /** Whose turn it is to look at their card. */
  peekIndex: number;
  /** Secret-ballot votes, one slot per player; null = not voted yet. */
  votes: (number | null)[];
  /** Player index voted out, or null when nobody was voted out. */
  voted: number | null;
  /** Did a caught imposter guess the word? null until decided. */
  guessedWord: boolean | null;
  /** Scores for this round have been added to the session. */
  scored: boolean;
};

export type Session = {
  players: string[];
  scores: number[];
  roundsPlayed: number;
  /** Keys of words already played this session: `${categoryId}:${ml}`. */
  usedWords: string[];
};
