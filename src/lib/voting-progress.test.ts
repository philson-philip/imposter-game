import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VotingProgress } from "@/components/voting-progress";
import { votingProgress, type VotingPlayer } from "./voting-progress";

const players: VotingPlayer[] = [
  { id: "a", name: "Rahul", hasVoted: false },
  { id: "b", name: "Arjun", hasVoted: false },
  { id: "c", name: "Anu", hasVoted: false },
];
const ids = players.map((player) => player.id);

describe("votingProgress", () => {
  it("lists every eligible voter before any votes are recorded, in round order", () => {
    expect(votingProgress(players, ["c", "a", "b"])).toEqual({
      voted: 0,
      total: 3,
      pending: [
        { id: "c", name: "Anu" },
        { id: "a", name: "Rahul" },
        { id: "b", name: "Arjun" },
      ],
    });
  });

  it("derives fresh progress from recorded votes and resets on a subsequent ballot", () => {
    const partial = players.map((player) => ({ ...player, hasVoted: player.id === "a" }));
    expect(votingProgress(partial, ids)).toEqual({
      voted: 1,
      total: 3,
      pending: [{ id: "b", name: "Arjun" }, { id: "c", name: "Anu" }],
    });
    const complete = partial.map((player) => ({ ...player, hasVoted: true }));
    expect(votingProgress(complete, ids)).toEqual({ voted: 3, total: 3, pending: [] });
    expect(votingProgress(JSON.parse(JSON.stringify(complete)), ids)).toEqual(votingProgress(complete, ids));
    expect(votingProgress(players, ids).pending).toHaveLength(3);
  });

  it("keeps different players with the same name and counts each player ID once", () => {
    const duplicates = [
      { id: "a", name: "Anu", hasVoted: true },
      { id: "b", name: "Anu", hasVoted: false },
    ];
    expect(votingProgress(duplicates, ["a", "b", "b", "a"])).toEqual({
      voted: 1,
      total: 2,
      pending: [{ id: "b", name: "Anu" }],
    });
    expect(votingProgress([...duplicates, duplicates[1]], ["a", "b"]).total).toBe(2);
    expect(votingProgress(duplicates.map((player) => ({ ...player, hasVoted: false })), ["a", "b"]).pending).toEqual([
      { id: "a", name: "Anu" },
      { id: "b", name: "Anu" },
    ]);
  });

  it("uses round eligibility to exclude eliminated players, late joiners, and departed players", () => {
    const roster = [
      { id: "active", name: "Active", hasVoted: true },
      { id: "out", name: "Eliminated", hasVoted: false },
      { id: "late", name: "Late joiner", hasVoted: false },
    ];
    expect(votingProgress(roster, ["active", "departed"])).toEqual({ voted: 1, total: 1, pending: [] });
    expect(votingProgress([], ["departed"])).toEqual({ voted: 0, total: 0, pending: [] });
  });

  it("retains disconnected eligible players and follows updated recorded state on reconnect", () => {
    const roster = [
      { id: "offline", name: "Offline", online: false, hasVoted: false },
      { id: "online", name: "Online", online: true, hasVoted: true },
    ];
    expect(votingProgress(roster, ["offline", "online"])).toEqual({
      voted: 1,
      total: 2,
      pending: [{ id: "offline", name: "Offline" }],
    });
    expect(votingProgress(roster.map((player) => ({ ...player, online: true, hasVoted: true })), ["offline", "online"]).pending).toEqual([]);
  });
});

describe("VotingProgress", () => {
  it("shows English progress and pending names without vote targets", () => {
    const html = renderToStaticMarkup(createElement(VotingProgress, {
      players: players.map((player) => ({ ...player, hasVoted: player.id === "a" })),
      eligibleIds: ids,
    }));
    expect(html).toContain("1 of 3 players voted");
    expect(html).toContain("Waiting for votes from:");
    expect(html).toContain("Arjun");
    expect(html).toContain("Anu");
    expect(html).not.toContain("Rahul");
    expect(html).not.toMatch(/[\u0D00-\u0D7F]/u);
    expect(html).toContain('aria-live="polite"');
  });

  it("localizes progress, waiting, and completed states in Malayalam", () => {
    const pending = renderToStaticMarkup(createElement(VotingProgress, { players, eligibleIds: ids, language: "ml" }));
    expect(pending).toContain("3 പേരിൽ 0 പേർ വോട്ട് ചെയ്തു");
    expect(pending).toContain("വോട്ട് ചെയ്യാൻ ബാക്കിയുള്ളവർ:");
    const complete = renderToStaticMarkup(createElement(VotingProgress, {
      players: players.map((player) => ({ ...player, hasVoted: true })),
      eligibleIds: ids,
      language: "ml",
    }));
    expect(complete).toContain("എല്ലാവരും വോട്ട് ചെയ്തു");
    expect(complete).not.toContain("വോട്ട് ചെയ്യാൻ ബാക്കിയുള്ളവർ:");
  });

  it("distinguishes a completed vote from having no eligible players", () => {
    const complete = renderToStaticMarkup(createElement(VotingProgress, {
      players: players.map((player) => ({ ...player, hasVoted: true })),
      eligibleIds: ids,
    }));
    expect(complete).toContain("All players have voted");
    const empty = renderToStaticMarkup(createElement(VotingProgress, { players, eligibleIds: [] }));
    expect(empty).toContain("0 of 0 players voted");
    expect(empty).toContain("No eligible voters");
    expect(empty).not.toContain("All players have voted");
  });
});
