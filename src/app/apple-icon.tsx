import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/mark-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const image = await markDataUri();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        { }
        <img src={image} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
