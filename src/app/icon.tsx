import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/mark-image";

export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id) === 512 ? 512 : 192;
  const image = await markDataUri();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0f0f13" }}>
        { }
        <img src={image} width={size} height={size} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
