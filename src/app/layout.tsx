import type { Metadata, Viewport } from "next";
import { Anek_Malayalam, Geist_Mono } from "next/font/google";
import "./globals.css";

const anek = Anek_Malayalam({
  subsets: ["latin", "malayalam"],
  variable: "--font-anek",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Imposter – Malayalam Party Word Game",
    template: "%s · Imposter",
  },
  description:
    "The pass-and-play party word game for Malayalam speakers. Everyone gets the same secret word, except the Imposter. Give clues, vote, and find them out.",
  applicationName: "Imposter Malayalam",
  keywords: ["imposter game", "malayalam", "party game", "word game", "kerala", "ഇംപോസ്റ്റർ"],
  appleWebApp: { capable: true, title: "Imposter", statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    siteName: "Imposter Malayalam",
    title: "Imposter – Malayalam Party Word Game",
    description:
      "One phone, 3–10 players. Everyone gets the same secret word, except the Imposter. Can you find them?",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0f0f13",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anek.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col font-sans">{children}</body>
    </html>
  );
}
