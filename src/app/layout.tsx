import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://atlas.floracarbon.ai";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Flora Mangrove Atlas — open mangrove monitoring",
    template: "%s · Flora Mangrove Atlas",
  },
  description:
    "Free, open-source mangrove monitoring: four decades of extent, canopy height, biomass, tidal change and live Sentinel-2 condition for any area you draw. Built by Flora Carbon AI.",
  applicationName: "Flora Mangrove Atlas",
  authors: [{ name: "Flora Carbon AI", url: "https://floracarbon.ai" }],
  keywords: ["mangrove", "blue carbon", "remote sensing", "Sundarbans", "Earth Engine", "dMRV", "open source"],
  openGraph: {
    title: "Flora Mangrove Atlas",
    description: "Open-source mangrove monitoring for everyone — extent, height, biomass and live condition.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d6b4f" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1412" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
