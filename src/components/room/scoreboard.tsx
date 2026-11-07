import type { PlayerView } from "@/lib/room-types";
import { Avatar } from "../avatar";

export function Scoreboard({
  players,
  deltas = {},
  youId,
  imposterId = null,
}: {
  players: PlayerView[];
  deltas?: Record<string, number>;
  youId: string;
  imposterId?: string | null;
}) {
  const sorted = players
    .map((p, index) => ({ p, index }))
    .sort((a, b) => b.p.score - a.p.score || a.p.name.localeCompare(b.p.name));
  const top = sorted[0]?.p.score ?? 0;
  return (
    <ol className="divide-y divide-ink-700 border-y border-ink-700">
      {sorted.map(({ p, index }, rank) => {
        const delta = deltas[p.id] ?? 0;
        return (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <span className="w-5 font-mono text-sm text-mist-500">{rank + 1}</span>
            <Avatar name={p.name} index={index} size="sm" />
            <span className="min-w-0 flex-1 truncate font-semibold text-mist-200">
              {p.name}
              {p.id === youId && <span className="ml-1 text-xs font-medium text-mist-500">(you)</span>}
              {p.id === imposterId && <span className="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-300">Imposter</span>}
              {p.score === top && top > 0 && rank === 0 && <span className="ml-1" aria-label="leader">👑</span>}
            </span>
            {delta !== 0 && (
              <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${delta > 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
            <span className="w-8 text-right font-mono text-lg font-semibold tabular-nums text-white">{p.score}</span>
          </li>
        );
      })}
    </ol>
  );
}
