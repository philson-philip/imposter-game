import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Imposter – Malayalam Party Word Game",
    short_name: "Imposter",
    description: "Everyone gets the same secret word, except the Imposter. Play with friends on your phones.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0f13",
    theme_color: "#0f0f13",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
