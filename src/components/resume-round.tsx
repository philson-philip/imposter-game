"use client";

import { useSyncExternalStore } from "react";
import { loadRound, loadSession, subscribeStorage } from "@/lib/storage";
import { ButtonLink } from "./ui";

function snapshot(): string | null {
  const round = loadRound();
  const session = loadSession();
  if (round && session && !round.scored) {
    return `Continue round ${round.number} on this phone · ${session.players.length} players`;
  }
  return null;
}

/** Shows a "continue" link when a pass-and-play round is in progress on this device. */
export function ResumeRound() {
  const label = useSyncExternalStore(subscribeStorage, snapshot, () => null);
  if (!label) return null;
  return (
    <ButtonLink href="/play" variant="secondary">
      {label}
    </ButtonLink>
  );
}
