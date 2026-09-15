import { compare } from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import {
  activeLockUntil,
  clearLoginThrottle,
  clientIp,
  emailKey,
  ipKey,
  recordLoginFailure,
} from "@/lib/auth/throttle";
import { prisma } from "@/lib/prisma";

/** Surfaced to the login form as `error.code === "locked"`. */
export class LockedOutError extends CredentialsSignin {
  code = "locked";
}

/**
 * Runs a brute-force-throttle step without letting its failure block sign-in.
 *
 * The throttle is a safeguard layered on top of the password check. If its
 * table is unavailable — most often a deploy that shipped before
 * `prisma migrate deploy` ran — refusing every login would lock the whole firm
 * out. So a throttle error is logged loudly and sign-in proceeds with the
 * password check alone.
 */
async function throttleSafely<T>(step: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    console.error(
      `[auth] Login throttle "${step}" failed; continuing without brute-force protection. ` +
        "If this mentions a missing table, run `npm run db:deploy` against this database.",
      error,
    );
    return null;
  }
}

/**
 * Email/password authentication for firm staff.
 *
 * There is no self-service sign-up by design: accounts are provisioned by an
 * Admin/Partner from the admin console.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const normalisedEmail = email.toLowerCase().trim();
        const ip = clientIp(request.headers);

        // Checked before bcrypt, so a locked key costs the attacker a cheap
        // query rather than costing the server a hash. The lock applies to
        // unknown addresses too, so it reveals nothing about who has an account.
        const keys = [emailKey(normalisedEmail), ...(ip ? [ipKey(ip)] : [])];
        if (await throttleSafely("check", () => activeLockUntil(keys))) {
          throw new LockedOutError();
        }

        const user = await prisma.user.findUnique({
          where: { email: normalisedEmail },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            passwordHash: true,
          },
        });

        // Hash a throwaway value when the user is missing so that a bad email
        // and a bad password take comparable time to reject.
        const hash =
          user?.passwordHash ??
          "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvaliduO";

        const passwordMatches = await compare(password, hash);

        if (!user || !passwordMatches || !user.isActive) {
          await throttleSafely("record", () => recordLoginFailure(normalisedEmail, ip));
          return null;
        }

        await throttleSafely("clear", () => clearLoginThrottle(normalisedEmail));

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
