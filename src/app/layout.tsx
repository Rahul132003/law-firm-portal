import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Source_Serif_4 } from "next/font/google";
import { FIRM_NAME } from "@/lib/firm";
import "./globals.css";

/**
 * Three faces, each with a job:
 *   Inter        — UI chrome and dense tables; best hinting at small sizes.
 *   Source Serif — headings; designed for screen, so it holds up at 15px.
 *   Plex Mono    — case numbers, file names, reference codes.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  weight: ["400", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${FIRM_NAME} · Case Management Portal`,
    template: `%s · ${FIRM_NAME}`,
  },
  description: `Internal case management portal for ${FIRM_NAME}.`,
  // Internal tool: keep it out of search indexes entirely.
  robots: { index: false, follow: false },
  // Installed as an app from the Home Screen (required for push on iOS).
  appleWebApp: { capable: true, title: FIRM_NAME, statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/192", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/180", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1a459e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${inter.variable} ${sourceSerif.variable} ${plexMono.variable}`}
    >
      <body className="min-h-full bg-canvas font-sans text-primary">
        {children}
      </body>
    </html>
  );
}
