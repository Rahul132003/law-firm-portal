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
        if (await activeLockUntil(keys)) {
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
          await recordLoginFailure(normalisedEmail, ip);
          return null;
        }

        await clearLoginThrottle(normalisedEmail);

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
