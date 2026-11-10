import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.resolve("next/package.json"));
const sharp = require("sharp");
const portrait = new URL("../public/brand/face-portrait.png", import.meta.url);
const face = await sharp(fileURLToPath(portrait)).resize(448, 448).toBuffer();

for (const [tone, start, end] of [["violet", "#6d28d9", "#a855f7"], ["rose", "#be123c", "#fb7185"]]) {
  const background = Buffer.from(`<svg width="512" height="512"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/></svg>`);
  const image = sharp(background).composite([{ input: face, left: 32, top: 32 }]);
  await image.clone().webp({ quality: 92 }).toFile(fileURLToPath(new URL(`../public/brand/face-${tone}.webp`, import.meta.url)));
  if (tone === "violet") {
    const png = await image.png().toBuffer();
    await writeFile(new URL("../public/brand/face-violet.png", import.meta.url), png);
    await sharp(png).resize(64, 64).png().toFile(fileURLToPath(new URL("../src/app/icon.png", import.meta.url)));
    const favicon = await sharp(png).resize(32, 32).png().toBuffer();
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    header[6] = 32;
    header[7] = 32;
    header.writeUInt16LE(1, 10);
    header.writeUInt16LE(32, 12);
    header.writeUInt32LE(favicon.length, 14);
    header.writeUInt32LE(22, 18);
    await writeFile(new URL("../src/app/favicon.ico", import.meta.url), Buffer.concat([header, favicon]));
  }
}
