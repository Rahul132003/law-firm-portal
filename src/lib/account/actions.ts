"use server";

import { compare, hash } from "bcryptjs";

import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

import { changePasswordSchema, fieldErrors } from "./validation";

const BCRYPT_ROUNDS = 12;

export type ChangePasswordState = {
  errors?: Record<string, string>;
  message?: string;
  ok?: boolean;
};

/**
 * Self-service password change.
 *
 * The current password is re-verified even though the caller already holds a
 * valid session: without it, anyone who walks up to an unlocked screen — or
 * who has stolen a session cookie — could lock the real owner out of their
 * account. Proving knowledge of the existing password is what makes this a
 * change rather than a takeover.
 */
export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser();

  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: text("currentPassword"),
    newPassword: text("newPassword"),
    confirmPassword: text("confirmPassword"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!account) return { message: "Your account could not be loaded." };

  const currentMatches = await compare(
    parsed.data.currentPassword,
    account.passwordHash,
  );

  if (!currentMatches) {
    return { errors: { currentPassword: "That is not your current password." } };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hash(parsed.data.newPassword, BCRYPT_ROUNDS) },
  });

  // Note: the existing session stays valid. Sessions are stateless JWTs, so
  // there is no server-side session store to invalidate — a signed-in device
  // continues to work until its token expires.
  return { ok: true, message: "Password updated." };
}
