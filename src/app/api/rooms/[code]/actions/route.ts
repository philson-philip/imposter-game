import { codeFrom, credentials, errorResponse, json, parseAction, readJson } from "@/server/http";
import { authenticate, performAction, readRoom, viewFor } from "@/server/rooms";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code: raw } = await ctx.params;
    const code = codeFrom(raw);
    const { playerId, token } = credentials(req);
    const action = parseAction(await readJson(req));

    const current = await readRoom(code, true);
    if (!current) return json({ error: "That room doesn't exist (or it expired)." }, 404);
    const player = authenticate(current, playerId, token);

    const room = await performAction(code, player.id, action);
    if (action.type === "leave" || !room.players.some((p) => p.id === player.id)) {
      return json({ left: true });
    }
    return json({ view: viewFor(room, player.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
