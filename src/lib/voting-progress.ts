export type VotingPlayer = {
  id: string;
  name: string;
  /** Whether the current round has a valid recorded vote from this player. */
  hasVoted: boolean;
};

export type VoteProgress = {
  voted: number;
  total: number;
  pending: { id: string; name: string }[];
};

export function votingProgress(players: readonly VotingPlayer[], eligibleIds: readonly string[]): VoteProgress {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const eligible = [...new Set(eligibleIds)].flatMap((id) => {
    const player = playersById.get(id);
    return player ? [player] : [];
  });
  const pending = eligible.filter((player) => !player.hasVoted).map(({ id, name }) => ({ id, name }));

  return { voted: eligible.length - pending.length, total: eligible.length, pending };
}
