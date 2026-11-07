"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  type Identity,
  clearIdentity,
  fetchView,
  joinRoomApi,
  loadIdentity,
  saveIdentity,
  sendAction,
} from "./room-client";
import type { RoomAction, RoomView } from "./room-types";

const POLL_MS = 1500;
const HIDDEN_POLL_MS = 5000;

export type RoomState = "join" | "loading" | "ready" | "gone";

export function useRoom(code: string) {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity | null>(() => loadIdentity(code));
  const [view, setView] = useState<RoomView | null>(null);
  const [state, setState] = useState<RoomState>(() => (loadIdentity(code) ? "loading" : "join"));
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  // The poller reads the latest known version without re-subscribing on every update.
  const versionRef = useRef(0);
  useEffect(() => {
    versionRef.current = view?.version ?? 0;
  }, [view]);

  const forget = useCallback(() => {
    clearIdentity(code);
    setIdentity(null);
    setView(null);
    setState("join");
  }, [code]);

  // Poll for changes while this screen is visible.
  useEffect(() => {
    if (!identity) return;
    let stopped = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => void tick(), ms);
    };

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "hidden") {
        schedule(HIDDEN_POLL_MS);
        return;
      }
      try {
        const res = await fetchView(identity, versionRef.current, controller.signal);
        if (stopped) return;
        failures = 0;
        setOffline(false);
        if (res.kind === "view") {
          setView(res.view);
          setState("ready");
        } else if (res.kind === "forbidden") {
          forget();
          return;
        } else if (res.kind === "gone") {
          setState("gone");
          return;
        }
      } catch (err) {
        if (stopped || (err instanceof DOMException && err.name === "AbortError")) return;
        failures += 1;
        if (failures >= 2) setOffline(true);
      }
      schedule(POLL_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") schedule(0);
    };
    document.addEventListener("visibilitychange", onVisible);
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [identity, forget]);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error]);

  const act = useCallback(
    async (action: RoomAction): Promise<boolean> => {
      if (!identity) return false;
      setBusy(true);
      try {
        const res = await sendAction(identity, action);
        if (res.left) {
          clearIdentity(code);
          router.replace("/");
          return true;
        }
        if (res.view) setView(res.view);
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) forget();
        else if (err instanceof ApiError && err.status === 404) setState("gone");
        else setError(err instanceof Error ? err.message : "Something went wrong.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [identity, code, forget, router],
  );

  const join = useCallback(
    async (name: string): Promise<boolean> => {
      setBusy(true);
      try {
        const res = await joinRoomApi(code, name);
        const id: Identity = { code, playerId: res.playerId, token: res.token, name };
        saveIdentity(id);
        setView(res.view);
        setIdentity(id);
        setState("ready");
        return true;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 410)) setState("gone");
        setError(err instanceof Error ? err.message : "Couldn't join.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [code],
  );

  return { identity, view, state, error, offline, busy, act, join, forget, setError };
}
