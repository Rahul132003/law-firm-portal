import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/enums";
import { isRouteAllowedForRole } from "@/lib/auth/roles";

/**
 * The half of the auth configuration that carries no database or bcrypt
 * imports, so it can be loaded by src/proxy.ts without dragging Prisma into
 * the proxy bundle. The credentials provider is added in src/auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    // Credentials-based sign-in cannot use database sessions.
    strategy: "jwt",
    maxAge: 60 * 60 * 8, // one working day
  },
  callbacks: {
    /**
     * Runs in the proxy on every matched request. This is an *optimistic*
     * check against the signed session cookie only — no database round trip.
     * Real enforcement happens in the data access layer.
     */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;

      const isPublic = pathname === "/login";

      if (!user) {
        return isPublic;
      }

      if (isPublic) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      if (!isRouteAllowedForRole(pathname, user.role)) {
        return Response.redirect(new URL("/no-access", request.nextUrl));
      }

      return true;
    },

    jwt({ token, user }) {
      // `user` is only present on the sign-in pass.
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },

    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role as Role;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
