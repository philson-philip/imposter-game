"use client";

import type { RoomAction, RoomView } from "./room-types";

export type Identity = { code: string; playerId: string; token: string; name: string };

const idKey = (code: string) => `imposter.room.${code}.v1`;
const NAME_KEY = "imposter.name.v1";

export function loadIdentity(code: string): Identity | null {
  try {
    const raw = window.localStorage.getItem(idKey(code));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Identity>;
    if (typeof v.playerId === "string" && typeof v.token === "string" && typeof v.name === "string") {
      return { code, playerId: v.playerId, token: v.token, name: v.name };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity): void {
  try {
    window.localStorage.setItem(idKey(identity.code), JSON.stringify(identity));
    window.localStorage.setItem(NAME_KEY, identity.name);
  } catch {
    // storage is optional
  }
}

export function clearIdentity(code: string): void {
  try {
    window.localStorage.removeItem(idKey(code));
  } catch {
    // ignore
  }
}

export function loadLastName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // keep the default message
  }
  return new ApiError(res.status, message);
}

function headersFor(identity?: Identity | null): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (identity) {
    h["x-player-id"] = identity.playerId;
    h["x-player-token"] = identity.token;
  }
  return h;
}

type JoinResponse = { code: string; playerId: string; token: string; view: RoomView };

export async function createRoomApi(name: string): Promise<JoinResponse> {
  const res = await fetch("/api/rooms", { method: "POST", headers: headersFor(), body: JSON.stringify({ name }) });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as JoinResponse;
}

export async function joinRoomApi(code: string, name: string): Promise<JoinResponse> {
  const res = await fetch(`/api/rooms/${code}/join`, { method: "POST", headers: headersFor(), body: JSON.stringify({ name }) });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as JoinResponse;
}

export type ViewResult =
  | { kind: "view"; view: RoomView }
  | { kind: "unchanged" }
  | { kind: "forbidden" }
  | { kind: "gone" };

export async function fetchView(identity: Identity, version: number, signal?: AbortSignal): Promise<ViewResult> {
  const res = await fetch(`/api/rooms/${identity.code}?v=${version}`, { headers: headersFor(identity), cache: "no-store", signal });
  if (res.status === 204) return { kind: "unchanged" };
  if (res.status === 403) return { kind: "forbidden" };
  if (res.status === 404 || res.status === 410) return { kind: "gone" };
  if (!res.ok) throw await parseError(res);
  const body = (await res.json()) as { view: RoomView };
  return { kind: "view", view: body.view };
}

export async function sendAction(identity: Identity, action: RoomAction): Promise<{ view?: RoomView; left?: boolean }> {
  const res = await fetch(`/api/rooms/${identity.code}/actions`, {
    method: "POST",
    headers: headersFor(identity),
    body: JSON.stringify(action),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as { view?: RoomView; left?: boolean };
}

export function roomUrl(code: string): string {
  return `${window.location.origin}/room/${code}`;
}

export async function shareRoom(code: string): Promise<"shared" | "copied" | "failed"> {
  const url = roomUrl(code);
  const data = { title: "Join my Imposter game", text: `Join my Imposter (Malayalam) game — room code ${code}`, url };
  try {
    if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(data))) {
      await navigator.share(data);
      return "shared";
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
