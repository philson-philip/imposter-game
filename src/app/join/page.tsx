"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Mark } from "@/components/mark";
import { Screen, Spotlight } from "@/components/shell";
import { Button, ButtonLink, Eyebrow } from "@/components/ui";
import { ROOM, isValidCode, normalizeCode } from "@/lib/room-logic";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const valid = isValidCode(code);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setError(`Room codes are ${ROOM.codeLength} letters or digits.`);
      return;
    }
    router.push(`/room/${code}`);
  };

  return (
    <Screen className="justify-center">
      <Spotlight />
      <Mark className="mx-auto h-20 w-20 animate-rise" />
      <Eyebrow>Join a game</Eyebrow>
      <h1 className="mt-1 text-center text-3xl font-extrabold tracking-tight text-white">Enter the room code</h1>
      <p className="mx-auto mt-2 max-w-xs text-center text-mist-400">Ask the host for the 5-character code, or open the link they shared.</p>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          value={code}
          onChange={(e) => {
            setCode(normalizeCode(e.target.value));
            setError(null);
          }}
          maxLength={ROOM.codeLength}
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="go"
          placeholder="KX7P2"
          aria-label="Room code"
          className="h-16 w-full rounded-2xl border border-ink-700 bg-ink-800 text-center font-mono text-3xl font-bold uppercase tracking-[0.3em] text-white placeholder:text-mist-500/60 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
        {error && (
          <p role="alert" className="text-center text-sm font-semibold text-rose-300">
            {error}
          </p>
        )}
        <Button type="submit" disabled={!valid}>
          Continue
        </Button>
        <ButtonLink href="/" variant="ghost" size="md" className="w-full">
          Back
        </ButtonLink>
      </form>
    </Screen>
  );
}
