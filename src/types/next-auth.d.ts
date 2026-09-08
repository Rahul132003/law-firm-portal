import type { Role } from "@/generated/prisma/enums";
import type { DefaultSession } from "next-auth";

/**
 * Widen the NextAuth session/JWT with the fields the portal relies on for
 * authorization. Keep this minimal — anything here is carried in the session
 * cookie on every request.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

/**
 * `next-auth/jwt` only re-exports `@auth/core/jwt`, so augmenting the former * would not merge into the real `JWT` interface. Augment the source module.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}

export {};
