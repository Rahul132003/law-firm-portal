import { ImageResponse } from "next/og";
import { FIRM_INITIALS } from "@/lib/firm";

/**
 * App and notification icons, drawn from the firm's initials so no binary
 * assets need to be committed. Served at /icons/192, /icons/512 and
 * /icons/badge (monochrome, for the Android status bar).
 */

const SIZES: Record<string, number> = { "180": 180, "192": 192, "512": 512, badge: 96 };

export async function GET(_request: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size: key } = await ctx.params;
  const size = SIZES[key];
  if (!size) return new Response("Not found", { status: 404 });

  const badge = key === "badge";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Badges must be white on transparent; the OS tints them.
          background: badge ? "transparent" : "#1a459e",
          color: "#ffffff",
          fontSize: size * (FIRM_INITIALS.length > 1 ? 0.4 : 0.55),
          fontWeight: 700,
          fontFamily: "serif",
          letterSpacing: -size * 0.01,
        }}
      >
        {FIRM_INITIALS || "LP"}
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=86400, immutable" },
    },
  );
}
