import { errorResponse, json, readJson, requireString } from "@/server/http";
import { createNewRoom, viewFor } from "@/server/rooms";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const name = requireString(body, "name", 60);
    const { room, player } = await createNewRoom(name);
    return json({ code: room.code, playerId: player.id, token: player.token, view: viewFor(room, player.id) }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
