"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Mark } from "@/components/mark";
import { Screen, Spotlight } from "@/components/shell";
import { Button, ButtonLink, Eyebrow } from "@/components/ui";
import { useHydrated } from "@/lib/hooks";
import { createRoomApi, loadLastName, saveIdentity } from "@/lib/room-client";
import { ROOM } from "@/lib/room-logic";

export default function NewGamePage() {
  const hydrated = useHydrated();
  return hydrated ? <NewGameForm /> : <Screen aria-busy="true" />;
}

function NewGameForm() {
  const router = useRouter();
  const [name, setName] = useState(() => loadLastName());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createRoomApi(trimmed);
      saveIdentity({ code: res.code, playerId: res.playerId, token: res.token, name: trimmed });
      router.push(`/room/${res.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create a room.");
      setBusy(false);
    }
  };

  return (
    <Screen className="justify-center">
      <Spotlight />
      <Mark className="mx-auto h-20 w-20 animate-rise" />
      <Eyebrow>New game</Eyebrow>
      <h1 className="mt-1 text-center text-3xl font-extrabold tracking-tight text-white">Host a room</h1>
      <p className="mx-auto mt-2 max-w-xs text-center text-mist-400">You&apos;ll get a code to share. Friends join on their own phones.</p>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-mist-300">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={ROOM.nameMax}
            autoFocus
            autoComplete="nickname"
            autoCapitalize="words"
            enterKeyHint="go"
            placeholder="What should we call you?"
            className="mt-1 h-13 w-full rounded-2xl border border-ink-700 bg-ink-800 px-4 text-lg text-white placeholder:text-mist-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold text-rose-300">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? "Creating room…" : "Create room"}
        </Button>
        <ButtonLink href="/" variant="ghost" size="md" className="w-full">
          Back
        </ButtonLink>
      </form>
    </Screen>
  );
}
