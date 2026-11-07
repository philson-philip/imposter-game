"use client";

import { CATEGORIES } from "@/data/words";
import { countWords } from "@/lib/game";
import type { RoomSettings } from "@/lib/room-types";
import { Chip, Segmented, Toggle } from "../ui";

/** Host-only controls for the next round: categories and options. Writes go straight to the room. */
export function RoundSetup({
  settings,
  onChange,
  disabled,
}: {
  settings: RoomSettings;
  onChange: (patch: Partial<RoomSettings>) => void;
  disabled?: boolean;
}) {
  const selected = settings.categoryIds;
  const toggle = (id: string) => {
    const ids = selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id];
    onChange({ categoryIds: ids.length === CATEGORIES.length ? [] : ids });
  };
  return (
    <div className={`space-y-6 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-mist-500">Category for this round</h3>
          <span className="text-sm text-mist-400">{countWords(CATEGORIES, selected)} words</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip selected={selected.length === 0} onClick={() => onChange({ categoryIds: [] })}>
            ✨ Everything
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c.id} selected={selected.includes(c.id)} onClick={() => toggle(c.id)}>
              <span aria-hidden>{c.emoji}</span> {c.en}
            </Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-mist-500">Options</h3>
        <Toggle
          checked={settings.imposterHint}
          onChange={(v) => onChange({ imposterHint: v })}
          label="Imposter sees the category"
          hint="Easier for the Imposter. Everyone sees the category."
        />
        <div className="space-y-2 pt-1">
          <p className="text-sm font-semibold text-mist-300">Show words as</p>
          <Segmented
            label="Word display"
            value={settings.wordDisplay}
            onChange={(v) => onChange({ wordDisplay: v })}
            options={[
              { value: "both", label: "മലയാളം + English" },
              { value: "en", label: "English" },
              { value: "ml", label: "മലയാളം" },
            ]}
          />
        </div>
        <div className="space-y-2 pt-1">
          <p className="text-sm font-semibold text-mist-300">Clues</p>
          <Segmented
            label="Clue mode"
            value={settings.clueMode}
            onChange={(v) => onChange({ clueMode: v })}
            options={[
              { value: "typed", label: "Type in the app" },
              { value: "spoken", label: "Say out loud" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export function categoryLabel(ids: string[]): string {
  if (ids.length === 0) return "Everything";
  return ids
    .map((id) => CATEGORIES.find((c) => c.id === id))
    .filter((c): c is (typeof CATEGORIES)[number] => Boolean(c))
    .map((c) => `${c.emoji} ${c.en}`)
    .join(", ");
}
