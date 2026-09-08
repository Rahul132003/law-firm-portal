import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { FIRM_NAME } from "@/lib/firm";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${FIRM_NAME} · Case Management Portal`,
    template: `%s · ${FIRM_NAME}`,
  },
  description: `Internal case management portal for ${FIRM_NAME}.`,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${sans.variable}`}
    >
      <body className="min-h-full font-sans bg-[#f8fafc] text-slate-900 selection:bg-sky-500/20 selection:text-sky-900">
        {children}
      </body>
    </html>
  );
}
