import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

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
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
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
          return null;
        }

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
