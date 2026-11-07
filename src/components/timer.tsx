"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

export function Timer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        try {
          navigator.vibrate?.([200, 100, 200, 100, 400]);
        } catch {
          // vibration is optional
        }
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [running]);

  const start = () => {
    endAt.current = Date.now() + remaining * 1000;
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    setRemaining(seconds);
  };

  const done = remaining === 0;
  const pct = seconds > 0 ? remaining / seconds : 0;
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-ink-700 bg-ink-800 p-3">
      <div
        aria-hidden
        className="relative h-16 w-16 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${done ? "var(--color-rose-500)" : "var(--color-violet-500)"} ${pct * 360}deg, var(--color-ink-700) 0)`,
        }}
      >
        <div className="absolute inset-[5px] flex items-center justify-center rounded-full bg-ink-800">
          <span className={`font-mono text-sm font-semibold tabular-nums ${done ? "text-rose-400" : "text-white"}`}>
            {mm}:{ss}
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-mist-200" role="timer" aria-live={done ? "assertive" : "off"}>
          {done ? "Time's up — go vote" : running ? "Clues in progress" : "Discussion timer"}
        </p>
        <p className="text-sm text-mist-400">
          {done ? "No more clues." : `${mm}:${ss} ${running ? "left" : "on the clock"}`}
        </p>
      </div>
      {done ? (
        <Button size="sm" variant="secondary" onClick={reset}>
          Reset
        </Button>
      ) : running ? (
        <Button size="sm" variant="secondary" onClick={pause}>
          Pause
        </Button>
      ) : (
        <Button size="sm" onClick={start}>
          {remaining === seconds ? "Start" : "Resume"}
        </Button>
      )}
    </div>
  );
}
