import { NextResponse } from "next/server";
import { RoomError, isValidCode, normalizeCode } from "@/lib/room-logic";
import type { RoomAction } from "@/lib/room-types";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof RoomError) return json({ error: err.message }, err.status);
  console.error("[imposter] unexpected error", err);
  return json({ error: "Something went wrong. Try again." }, 500);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new RoomError(400, "Send a JSON object.");
  }
}

export function requireString(body: Record<string, unknown>, field: string, max = 200): string {
  const v = body[field];
  if (typeof v !== "string") throw new RoomError(400, `Missing ${field}.`);
  return v.slice(0, max);
}

export function codeFrom(raw: string): string {
  const code = normalizeCode(raw);
  if (!isValidCode(code)) throw new RoomError(400, "That doesn't look like a room code.");
  return code;
}

export function credentials(req: Request): { playerId: string | null; token: string | null } {
  return { playerId: req.headers.get("x-player-id"), token: req.headers.get("x-player-token") };
}

const ALLOWED_SETTINGS = new Set(["categoryIds", "imposterHint", "wordDisplay", "clueMode"]);

/** Validates an untrusted action payload into a RoomAction. */
export function parseAction(body: Record<string, unknown>): RoomAction {
  const type = body.type;
  switch (type) {
    case "setSettings": {
      const raw = body.settings;
      if (typeof raw !== "object" || raw === null) throw new RoomError(400, "Missing settings.");
      const settings: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (!ALLOWED_SETTINGS.has(k)) continue;
        if (k === "categoryIds") {
          if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) throw new RoomError(400, "Bad categories.");
        }
        settings[k] = v;
      }
      return { type, settings };
    }
    case "startRound": {
      const ids = body.categoryIds;
      if (ids !== undefined && (!Array.isArray(ids) || !ids.every((x) => typeof x === "string"))) {
        throw new RoomError(400, "Bad categories.");
      }
      return { type, categoryIds: ids as string[] | undefined };
    }
    case "submitClue":
      return { type, text: requireString(body, "text", 200) };
    case "vote":
      return { type, targetId: requireString(body, "targetId", 40) };
    case "guess": {
      const index = body.index;
      if (typeof index !== "number") throw new RoomError(400, "Missing index.");
      return { type, index };
    }
    case "kick":
      return { type, playerId: requireString(body, "playerId", 40) };
    case "backToLobby":
      return { type, resetScores: body.resetScores === true };
    case "skipTurn":
    case "startVoting":
    case "endVoting":
    case "skipGuess":
    case "continueRound":
    case "endRound":
    case "endGame":
    case "leave":
    case "claimHost":
      return { type };
    default:
      throw new RoomError(400, "Unknown action.");
  }
}
