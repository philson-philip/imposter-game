import { codeFrom, errorResponse, json, readJson, requireString } from "@/server/http";
import { joinExistingRoom, viewFor } from "@/server/rooms";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code: raw } = await ctx.params;
    const code = codeFrom(raw);
    const body = await readJson(req);
    const name = requireString(body, "name", 60);
    const { room, player } = await joinExistingRoom(code, name);
    return json({ code: room.code, playerId: player.id, token: player.token, view: viewFor(room, player.id) }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
