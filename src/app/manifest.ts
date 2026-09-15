import type { MetadataRoute } from "next";
import { FIRM_NAME } from "@/lib/firm";

/**
 * Makes the portal installable ("Add to Home Screen"). On iPhone and iPad,
 * web push only works once the portal is installed this way.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${FIRM_NAME} Portal`,
    short_name: FIRM_NAME.length > 12 ? "Firm Portal" : FIRM_NAME,
    description: `Internal case management portal for ${FIRM_NAME}.`,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a459e",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
