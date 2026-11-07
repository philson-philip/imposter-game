"use client";

import { useEffect, useSyncExternalStore } from "react";
import { loadRound, loadSession, loadSettings, subscribeStorage } from "./storage";
import type { Round, Session, Settings } from "./types";

const subscribeNoop = () => () => {};

/** False during server rendering and hydration, true once the client has taken over. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

/** Keeps the screen awake while the component is visible (best effort). */
export function useWakeLock(): void {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        if (!("wakeLock" in navigator)) return;
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) await next.release();
        else lock = next;
      } catch {
        // Wake lock is optional; browsers may refuse it.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release().catch(() => {});
      lock = null;
    };
  }, []);
}

const nullSnapshot = () => null;

/** The pass-and-play round stored on this device; re-renders when the game writes to storage. */
export function useStoredRound(): Round | null {
  return useSyncExternalStore(subscribeStorage, loadRound, nullSnapshot);
}

export function useStoredSession(): Session | null {
  return useSyncExternalStore(subscribeStorage, loadSession, nullSnapshot);
}

export function useStoredSettings(): Settings {
  return useSyncExternalStore(subscribeStorage, loadSettings, loadSettings);
}
