import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/mark-svg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        { }
        <img src={markDataUri({ rounded: false })} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
