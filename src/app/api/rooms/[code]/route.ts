import { codeFrom, credentials, errorResponse, json } from "@/server/http";
import { authenticate, readRoom, recordPresence, viewFor } from "@/server/rooms";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code: raw } = await ctx.params;
    const code = codeFrom(raw);
    const { playerId, token } = credentials(req);
    const url = new URL(req.url);
    const known = Number(url.searchParams.get("v") ?? "0");

    let room = await readRoom(code);
    if (!room) return json({ error: "That room doesn't exist (or it expired)." }, 404);
    const player = authenticate(room, playerId, token);
    room = await recordPresence(room, player.id);
    if (Number.isFinite(known) && known > 0 && room.version === known) {
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }
    return json({ view: viewFor(room, player.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
