import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/mark-image";

export const alt = "Imposter – Malayalam party word game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const image = await markDataUri();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 96px",
          gap: 64,
          background: "radial-gradient(circle at 50% 0%, #2a1a4a 0%, #0f0f13 60%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        { }
        <img src={image} width={300} height={300} style={{ borderRadius: 72 }} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>Imposter</div>
          <div style={{ fontSize: 44, color: "#a78bfa", marginTop: 10, fontWeight: 700 }}>Malayalam party word game</div>
          <div style={{ fontSize: 32, color: "#a0a0b8", marginTop: 28, maxWidth: 640, lineHeight: 1.3 }}>
            Everyone gets the same secret word. One of you doesn&apos;t. Play on your phones with a room code.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
