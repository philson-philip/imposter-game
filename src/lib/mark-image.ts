import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function markDataUri(): Promise<string> {
  const image = await readFile(join(process.cwd(), "public/brand/face-violet.png"));
  return `data:image/png;base64,${image.toString("base64")}`;
}
