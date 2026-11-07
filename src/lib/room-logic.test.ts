import { describe, expect, it } from "vitest";
import {
  ROOM,
  applyAction,
  createRoom,
  finalize,
  isValidCode,
  joinRoom,
  makeCode,
  normalizeCode,
  toView,
  touch,
  turnOf,
} from "./room-logic";
import type { Room, RoomAction } from "./room-types";
import type { Category } from "./types";

const cats: Category[] = [
  {
    id: "food",
    en: "Food",
    ml: "ഭക്ഷണം",
    emoji: "🍛",
    words: Array.from({ length: 8 }, (_, i) => ({ ml: `വാക്ക്${i}`, en: `Word${i}` })),
  },
  { id: "tiny", en: "Tiny", ml: "ചെറുത്", emoji: "🔬", words: [{ ml: "ഒന്ന്", en: "One" }, { ml: "രണ്ട്", en: "Two" }] },
];

/** Deterministic random for reproducible rounds. */
function seeded(seed = 1) {
  let s = seed >>> 0;
  return (n: number) => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(u * n);
  };
}

const T0 = 1_000_000;

function makeRoom(names = ["Host", "Anu", "Biju", "Chinnu"]) {
  const { room: r0, player: host } = createRoom("ABCDE", names[0], T0);
  let room = r0;
  const ids = [host.id];
  for (const n of names.slice(1)) {
    const res = joinRoom(room, n, T0);
    room = res.room;
    ids.push(res.player.id);
  }
  return { room, ids };
}

function act(room: Room, actor: string, action: RoomAction, now = T0 + 1, random = seeded(7)) {
  return finalize(applyAction(room, actor, action, now, { categories: cats, random }));
}

function startRound(room: Room, host: string, categoryIds?: string[], random = seeded(7)) {
  return act(room, host, { type: "startRound", categoryIds }, T0 + 1, random);
}

describe("codes", () => {
  it("generates valid, unambiguous codes", () => {
    for (let i = 0; i < 50; i++) {
      const code = makeCode();
      expect(isValidCode(code)).toBe(true);
      expect(code).not.toMatch(/[01IO]/);
    }
    expect(normalizeCode(" ab-cd e ")).toBe("ABCDE");
    expect(isValidCode("ABCD")).toBe(false);
  });
});

describe("lobby", () => {
  it("creates a room with the host and lets others join with unique names", () => {
    const { room: r0 } = createRoom("ABCDE", "  Host  ", T0);
    expect(r0.players[0].name).toBe("Host");
    const a = joinRoom(r0, "host", T0);
    expect(a.player.name).toBe("host 2");
    expect(a.room.version).toBe(r0.version + 1);
    expect(() => joinRoom(r0, "   ", T0)).toThrow(/name/);
  });

  it("refuses joins once the room is full or ended", () => {
    const { room } = makeRoom();
    let full = room;
    while (full.players.length < ROOM.maxPlayers) full = joinRoom(full, "p", T0).room;
    expect(() => joinRoom(full, "late", T0)).toThrow(/full/);
    const ended = { ...room, status: "ended" as const };
    expect(() => joinRoom(ended, "late", T0)).toThrow(/ended/);
  });

  it("only persists presence every so often", () => {
    const { room, ids } = makeRoom();
    expect(touch(room, ids[1], T0 + 1000)).toBeNull();
    const touched = touch(room, ids[1], T0 + ROOM.touchEveryMs + 1);
    expect(touched?.players[1].lastSeen).toBe(T0 + ROOM.touchEveryMs + 1);
    expect(touched?.version).toBe(room.version);
  });
});

describe("starting a round", () => {
  it("requires the host and enough players", () => {
    const { room, ids } = makeRoom(["Host", "Anu"]);
    expect(() => startRound(room, ids[0])).toThrow(/at least/);
    const { room: r4, ids: ids4 } = makeRoom();
    expect(() => startRound(r4, ids4[1])).toThrow(/host/);
  });

  it("picks a random imposter, a clue order containing everyone, and records the word", () => {
    const { room, ids } = makeRoom();
    const r = startRound(room, ids[0], ["food"]);
    expect(r.status).toBe("playing");
    const round = r.round!;
    expect(ids).toContain(round.imposterId);
    expect([...round.playerIds].sort()).toEqual([...ids].sort());
    expect(round.phase).toBe("clues");
    expect(round.categoryId).toBe("food");
    expect(r.usedWords).toEqual([`food:${round.word.ml}`]);
    expect(r.settings.categoryIds).toEqual(["food"]);
  });

  it("spreads imposters and starters across players", () => {
    const { room, ids } = makeRoom();
    const imposters = new Set<string>();
    const starters = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const r = startRound(room, ids[0], undefined, seeded(i + 1));
      imposters.add(r.round!.imposterId);
      starters.add(r.round!.playerIds[0]);
    }
    expect(imposters.size).toBe(4);
    expect(starters.size).toBe(4);
  });

  it("never repeats a word until the category is exhausted", () => {
    const { room, ids } = makeRoom();
    let r = room;
    const seen: string[] = [];
    for (let i = 0; i < 2; i++) {
      r = startRound(r, ids[0], ["tiny"], seeded(i + 3));
      seen.push(r.round!.word.ml);
      r = act(r, ids[0], { type: "endGame" });
      r = act(r, ids[0], { type: "backToLobby", resetScores: false });
      r = { ...r, status: "lobby" };
    }
    expect(new Set(seen).size).toBe(2);
    r = startRound(r, ids[0], ["tiny"], seeded(9));
    expect(r.usedWords).toHaveLength(1);
  });

  it("refuses to start while a round is running", () => {
    const { room, ids } = makeRoom();
    const r = startRound(room, ids[0]);
    expect(() => startRound(r, ids[0])).toThrow(/already running/);
  });
});

describe("clues", () => {
  it("enforces turn order and moves to voting after everyone", () => {
    const { room, ids } = makeRoom();
    let r = startRound(room, ids[0], ["food"]);
    const order = r.round!.playerIds;
    expect(() => act(r, order[1], { type: "submitClue", text: "x" })).toThrow(/not your turn/);
    expect(() => act(r, order[0], { type: "submitClue", text: "   " })).toThrow(/clue/i);
    r = act(r, order[0], { type: "submitClue", text: "  spicy   thing " });
    expect(r.round!.clues[0]).toEqual({ playerId: order[0], text: "spicy thing", skipped: false });
    expect(turnOf(r.round!)).toBe(order[1]);
    r = act(r, ids[0], { type: "skipTurn" });
    expect(r.round!.clues[1].skipped).toBe(true);
    r = act(r, order[2], { type: "submitClue", text: "c" });
    r = act(r, order[3], { type: "submitClue", text: "d" });
    expect(r.round!.phase).toBe("vote");
    expect(turnOf(r.round!)).toBeNull();
  });

  it("lets the host jump to voting in spoken mode", () => {
    const { room, ids } = makeRoom();
    let r = act(room, ids[0], { type: "setSettings", settings: { clueMode: "spoken" } });
    r = startRound(r, ids[0]);
    expect(() => act(r, r.round!.playerIds[0], { type: "submitClue", text: "x" })).toThrow(/spoken/);
    r = act(r, ids[0], { type: "startVoting" });
    expect(r.round!.phase).toBe("vote");
  });
});

function toVote(room: Room, host: string) {
  let r = startRound(room, host, ["food"]);
  r = act(r, host, { type: "startVoting" });
  return r;
}

describe("voting and scoring", () => {
  it("rejects self votes, non-participants and votes outside the vote phase", () => {
    const { room, ids } = makeRoom();
    const r = startRound(room, ids[0]);
    expect(() => act(r, ids[1], { type: "vote", targetId: ids[2] })).toThrow(/isn't open/);
    const v = act(r, ids[0], { type: "startVoting" });
    expect(() => act(v, ids[1], { type: "vote", targetId: ids[1] })).toThrow(/yourself/);
    const late = joinRoom(v, "Late", T0 + 5);
    expect(() => act(late.room, late.player.id, { type: "vote", targetId: ids[1] })).toThrow(/round/);
  });

  it("catches the imposter, offers a guess, and scores a wrong guess", () => {
    const { room, ids } = makeRoom();
    let r = toVote(room, ids[0]);
    const imp = r.round!.imposterId;
    for (const id of ids) if (id !== imp) r = act(r, id, { type: "vote", targetId: imp });
    r = act(r, imp, { type: "vote", targetId: ids.find((x) => x !== imp)! });
    expect(r.round!.phase).toBe("guess");
    expect(r.round!.eliminatedId).toBe(imp);
    const options = r.round!.guessOptions!;
    expect(options).toHaveLength(ROOM.guessOptionCount);
    expect(options.filter((w) => w.ml === r.round!.word.ml)).toHaveLength(1);
    expect(() => act(r, ids.find((x) => x !== imp)!, { type: "guess", index: 0 })).toThrow(/imposter/);
    const wrong = options.findIndex((w) => w.ml !== r.round!.word.ml);
    r = act(r, imp, { type: "guess", index: wrong });
    expect(r.round!.phase).toBe("reveal");
    expect(r.round!.guessedWord).toBe(false);
    expect(r.roundsPlayed).toBe(1);
    for (const p of r.players) expect(p.score).toBe(p.id === imp ? 0 : 1);
    // settling twice must not double count
    expect(finalize(r).players).toEqual(r.players);
  });

  it("rewards a correct guess and the host can skip the guess", () => {
    const { room, ids } = makeRoom();
    let r = toVote(room, ids[0]);
    const imp = r.round!.imposterId;
    for (const id of ids) if (id !== imp) r = act(r, id, { type: "vote", targetId: imp });
    r = act(r, ids[0], { type: "endVoting" });
    expect(r.round!.phase).toBe("guess");
    const right = r.round!.guessOptions!.findIndex((w) => w.ml === r.round!.word.ml);
    const guessed = act(r, imp, { type: "guess", index: right });
    expect(guessed.players.find((p) => p.id === imp)!.score).toBe(2);
    const skipped = act(r, ids[0], { type: "skipGuess" });
    expect(skipped.round!.guessedWord).toBe(false);
    expect(skipped.players.find((p) => p.id === imp)!.score).toBe(0);
  });

  it("keeps the imposter hidden after an incorrect vote until the host ends the round", () => {
    const { room, ids } = makeRoom();
    let r = toVote(room, ids[0]);
    const imp = r.round!.imposterId;
    const victim = ids.find((x) => x !== imp)!;
    for (const id of ids) if (id !== victim) r = act(r, id, { type: "vote", targetId: victim });
    r = act(r, ids[0], { type: "endVoting" });
    expect(r.round!.phase).toBe("decision");
    expect(r.round!.eliminatedId).toBe(victim);
    expect(r.players.every((p) => p.score === 0)).toBe(true);
    for (const id of ids) {
      const view = toView(r, id, T0);
      expect(view.round!.imposterId).toBeNull();
      expect(view.round!.word).toBeNull();
    }
    expect(() => act(r, ids[1], { type: "continueRound" })).toThrow(/host/i);
    expect(() => act(r, ids[1], { type: "endRound" })).toThrow(/host/i);
    r = act(r, ids[0], { type: "endRound" });
    expect(r.round!.phase).toBe("reveal");
    expect(r.players.find((p) => p.id === imp)!.score).toBe(3);
    expect(r.players.filter((p) => p.id !== imp).every((p) => p.score === 0)).toBe(true);
  });

  it("continues with the same secret and excludes innocent players already voted out", () => {
    const { room, ids } = makeRoom(["Host", "Anu", "Biju", "Chinnu", "Devi"]);
    let r = toVote(room, ids[0]);
    const imp = r.round!.imposterId;
    const word = r.round!.word;
    const victim = ids.find((x) => x !== imp)!;
    for (const id of ids) if (id !== victim) r = act(r, id, { type: "vote", targetId: victim });
    r = act(r, ids[0], { type: "endVoting" });
    r = act(r, ids[0], { type: "continueRound" });
    expect(r.round!.phase).toBe("clues");
    expect(r.round!.imposterId).toBe(imp);
    expect(r.round!.word).toEqual(word);
    expect(r.round!.number).toBe(1);
    expect(r.round!.cycle).toBe(2);
    expect(r.round!.clues).toEqual([]);
    expect(toView(r, victim, T0).round!.you.isEliminated).toBe(true);
    expect(toView(r, victim, T0).round!.you.isParticipant).toBe(false);
    expect(toView(r, imp, T0).round!.playerIds).not.toContain(victim);
    expect(r.roundsPlayed).toBe(0);
    for (const id of toView(r, imp, T0).round!.playerIds) {
      expect(turnOf(r.round!)).toBe(id);
      r = act(r, id, { type: "submitClue", text: "another clue" });
    }
    expect(r.round!.phase).toBe("vote");
    expect(() => act(r, victim, { type: "vote", targetId: imp })).toThrow(/out|round/i);
    const crew = ids.filter((id) => id !== victim && id !== imp);
    for (const id of crew) r = act(r, id, { type: "vote", targetId: imp });
    r = act(r, ids[0], { type: "endVoting" });
    expect(r.round!.phase).toBe("guess");
    r = act(r, ids[0], { type: "skipGuess" });
    expect(r.round!.phase).toBe("reveal");
    expect(r.roundsPlayed).toBe(1);
    expect(r.players.find((p) => p.id === victim)!.score).toBe(1);
  });

  it("awards one imposter win when the host stops after three unsuccessful clue cycles", () => {
    const { room, ids } = makeRoom(["Host", "Anu", "Biju", "Chinnu", "Devi", "Ebi"]);
    let r = startRound(room, ids[0]);
    const imp = r.round!.imposterId;
    const victims = ids.filter((id) => id !== imp).slice(0, 3);
    for (let cycle = 1; cycle <= 3; cycle++) {
      r = act(r, ids[0], { type: "startVoting" });
      const victim = victims[cycle - 1];
      for (const id of toView(r, imp, T0).round!.playerIds) {
        if (id !== victim) r = act(r, id, { type: "vote", targetId: victim });
      }
      r = act(r, ids[0], { type: "endVoting" });
      expect(r.round!.phase).toBe("decision");
      expect(r.round!.cycle).toBe(cycle);
      expect(r.players.every((p) => p.score === 0)).toBe(true);
      expect(toView(r, ids[0], T0).round!.imposterId).toBeNull();
      if (cycle < 3) r = act(r, ids[0], { type: "continueRound" });
    }
    r = act(r, ids[0], { type: "endGame" });
    expect(r.status).toBe("ended");
    expect(r.roundsPlayed).toBe(1);
    expect(r.players.find((p) => p.id === imp)!.score).toBe(3);
    expect(r.players.filter((p) => p.id !== imp).every((p) => p.score === 0)).toBe(true);
    expect(finalize(r)).toEqual(r);
  });

  it("runs one revote on a tie, then lets the host decide whether to stop", () => {
    const { room, ids } = makeRoom();
    let r = toVote(room, ids[0]);
    const [a, b, c, d] = ids;
    r = act(r, a, { type: "vote", targetId: b });
    r = act(r, b, { type: "vote", targetId: a });
    r = act(r, c, { type: "vote", targetId: b });
    r = act(r, d, { type: "vote", targetId: a });
    expect(r.round!.phase).toBe("vote");
    expect(r.round!.revote).toBe(true);
    expect([...r.round!.candidates!].sort()).toEqual([a, b].sort());
    expect(r.round!.votes).toEqual({});
    expect(() => act(r, a, { type: "vote", targetId: c })).toThrow(/tied/);
    r = act(r, c, { type: "vote", targetId: a });
    r = act(r, d, { type: "vote", targetId: b });
    r = act(r, ids[0], { type: "endVoting" });
    expect(r.round!.phase).toBe("decision");
    expect(r.round!.noElimination).toBe(true);
    r = act(r, ids[0], { type: "endRound" });
    expect(r.players.find((p) => p.id === r.round!.imposterId)!.score).toBe(3);
  });

  it("waits for the host when voting closes without votes", () => {
    const { room, ids } = makeRoom();
    let r = toVote(room, ids[0]);
    r = act(r, ids[0], { type: "endVoting" });
    expect(r.round!.phase).toBe("decision");
    expect(r.round!.noElimination).toBe(true);
  });
});

describe("continuing a game", () => {
  it("keeps the same room and cumulative scores for 100 rounds until the host ends it", () => {
    const { room, ids } = makeRoom();
    let current = room;
    for (let number = 1; number <= 100; number++) {
      const before = current.players.map((p) => p.score);
      current = startRound(current, ids[0]);
      expect(current.round!.number).toBe(number);
      expect(current.players.map((p) => p.score)).toEqual(before);
      expect(() => act(current, ids[1], { type: "endGame" })).toThrow(/host/i);
      current = act(current, ids[0], { type: "startVoting" });
      current = act(current, ids[0], { type: "endVoting" });
      current = act(current, ids[0], { type: "endRound" });
      expect(current.code).toBe(room.code);
      expect(current.status).toBe("playing");
      expect(current.round!.phase).toBe("reveal");
      expect(current.roundsPlayed).toBe(number);
      expect(current.players.map((p, i) => p.score - before[i])).toEqual(
        current.players.map((p) => p.id === current.round!.imposterId ? 3 : 0),
      );
    }
    const ended = act(current, ids[0], { type: "endGame" });
    expect(ended.status).toBe("ended");
    expect(ended.code).toBe(room.code);
    expect(ended.players).toEqual(current.players);
    expect(ended.roundsPlayed).toBe(100);
  });
});

describe("players leaving", () => {
  it("hands the host role to the longest-standing player", () => {
    const { room, ids } = makeRoom();
    const r = act(room, ids[0], { type: "leave" });
    expect(r.hostId).toBe(ids[1]);
    expect(r.players.map((p) => p.id)).toEqual(ids.slice(1));
  });

  it("aborts the round without points when the imposter leaves", () => {
    const { room, ids } = makeRoom(["Host", "Anu", "Biju", "Chinnu", "Devi"]);
    let r = startRound(room, ids[0]);
    const imp = r.round!.imposterId;
    r = imp === ids[0] ? act(r, imp, { type: "leave" }) : act(r, ids[0], { type: "kick", playerId: imp });
    expect(r.round!.phase).toBe("reveal");
    expect(r.round!.aborted).toBe(true);
    expect(r.players.every((p) => p.score === 0)).toBe(true);
    expect(r.roundsPlayed).toBe(1);
  });

  it("drops votes for a player who leaves and finishes voting when the last missing voter leaves", () => {
    const { room, ids } = makeRoom(["Host", "Anu", "Biju", "Chinnu", "Devi"]);
    let r = toVote(room, ids[0]);
    const imp = r.round!.imposterId;
    const [leaver, other] = ids.filter((x) => x !== imp && x !== ids[0]);
    for (const id of ids) if (id !== leaver && id !== imp) r = act(r, id, { type: "vote", targetId: imp });
    r = act(r, imp, { type: "vote", targetId: leaver });
    expect(r.round!.phase).toBe("vote");
    // the imposter's vote pointed at the leaver, so it is discarded and voting stays open
    let after = act(r, leaver, { type: "leave" });
    expect(after.round!.phase).toBe("vote");
    expect(after.round!.votes[imp]).toBeUndefined();
    expect(after.round!.playerIds).not.toContain(leaver);
    // with a vote for someone else, the leaver was the only missing voter
    r = act(r, imp, { type: "vote", targetId: other });
    after = act(r, leaver, { type: "leave" });
    expect(after.round!.phase).toBe("guess");
    expect(after.round!.eliminatedId).toBe(imp);
  });

  it("ends the room when the last player leaves", () => {
    const { room, ids } = makeRoom();
    let r = room;
    for (const id of ids) r = act(r, id, { type: "leave" });
    expect(r.players).toHaveLength(0);
    expect(r.status).toBe("ended");
  });

  it("lets a player claim host only after the host goes quiet", () => {
    const { room, ids } = makeRoom();
    expect(() => act(room, ids[1], { type: "claimHost" }, T0 + 1000)).toThrow(/still here/);
    const r = act(room, ids[1], { type: "claimHost" }, T0 + ROOM.hostClaimAfterMs + 1);
    expect(r.hostId).toBe(ids[1]);
  });
});

describe("views", () => {
  it("hides secrets from the wrong eyes", () => {
    const { room, ids } = makeRoom();
    const r = startRound(room, ids[0], ["food"]);
    const imp = r.round!.imposterId;
    const crew = ids.find((x) => x !== imp)!;
    const impView = toView(r, imp, T0 + 2, cats);
    const crewView = toView(r, crew, T0 + 2, cats);
    expect(impView.round!.you.isImposter).toBe(true);
    expect(impView.round!.you.word).toBeNull();
    expect(impView.round!.you.category).toBeNull();
    expect(impView.round!.imposterId).toBeNull();
    expect(crewView.round!.you.word).toEqual(r.round!.word);
    expect(crewView.round!.you.category?.id).toBe("food");
    expect(crewView.round!.imposterId).toBeNull();
    expect(crewView.round!.word).toBeNull();
    expect(crewView.round!.category).toBeNull();
    expect(JSON.stringify(crewView)).not.toContain("token");
  });

  it("shows the category to everyone when the hint is on", () => {
    const { room, ids } = makeRoom();
    const r = startRound(act(room, ids[0], { type: "setSettings", settings: { imposterHint: true } }), ids[0], ["food"]);
    const v = toView(r, r.round!.imposterId, T0 + 2, cats);
    expect(v.round!.category?.id).toBe("food");
    expect(v.round!.you.category?.id).toBe("food");
  });

  it("reveals everything once the round is over", () => {
    const { room, ids } = makeRoom();
    let r = toVote(room, ids[0]);
    r = act(r, ids[0], { type: "endVoting" });
    r = act(r, ids[0], { type: "endRound" });
    const v = toView(r, ids[1], T0 + 2, cats);
    expect(v.round!.imposterId).toBe(r.round!.imposterId);
    expect(v.round!.word).toEqual(r.round!.word);
    expect(v.round!.tally).toEqual([]);
    expect(v.players.find((p) => p.id === r.round!.imposterId)!.score).toBe(3);
  });

  it("only shows guess options to the imposter", () => {
    const { room, ids } = makeRoom();
    let r = toVote(room, ids[0]);
    const imp = r.round!.imposterId;
    for (const id of ids) if (id !== imp) r = act(r, id, { type: "vote", targetId: imp });
    r = act(r, ids[0], { type: "endVoting" });
    expect(toView(r, imp, T0, cats).round!.you.guessOptions).toHaveLength(5);
    expect(toView(r, ids.find((x) => x !== imp)!, T0, cats).round!.you.guessOptions).toBeNull();
    expect(toView(r, ids[1], T0, cats).round!.eliminatedId).toBe(imp);
  });
});
