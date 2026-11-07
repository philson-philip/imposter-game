import { votingProgress, type VotingPlayer } from "@/lib/voting-progress";

const LABELS = {
  en: {
    count: (voted: number, total: number) => `${voted} of ${total} players voted`,
    waiting: "Waiting for votes from:",
    complete: "All players have voted",
    empty: "No eligible voters",
  },
  ml: {
    count: (voted: number, total: number) => `${total} പേരിൽ ${voted} പേർ വോട്ട് ചെയ്തു`,
    waiting: "വോട്ട് ചെയ്യാൻ ബാക്കിയുള്ളവർ:",
    complete: "എല്ലാവരും വോട്ട് ചെയ്തു",
    empty: "വോട്ട് ചെയ്യാൻ അർഹരായ കളിക്കാരില്ല",
  },
};

export function VotingProgress({
  players,
  eligibleIds,
  language = "en",
  className = "",
}: {
  players: readonly VotingPlayer[];
  eligibleIds: readonly string[];
  language?: "en" | "ml";
  className?: string;
}) {
  const progress = votingProgress(players, eligibleIds);
  const labels = LABELS[language];

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      lang={language}
      className={`rounded-2xl border border-ink-700 bg-ink-800/60 p-4 ${className}`}
    >
      <p className="text-sm font-semibold text-mist-200">{labels.count(progress.voted, progress.total)}</p>
      {progress.pending.length > 0 ? (
        <>
          <p className="mt-3 text-sm text-mist-400">{labels.waiting}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {progress.pending.map((player) => (
              <li key={player.id} className="max-w-full break-words rounded-xl border border-ink-700 bg-ink-900 px-3 py-1.5 text-sm font-semibold text-mist-200">
                {player.name}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-sm text-mist-400">{progress.total === 0 ? labels.empty : labels.complete}</p>
      )}
    </div>
  );
}
