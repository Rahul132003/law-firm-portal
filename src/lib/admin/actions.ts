"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";

import { canManageUsers } from "@/lib/auth/roles";
import { requireCapability } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

import {
  fieldErrors,
  passwordResetSchema,
  userCreateSchema,
  userUpdateSchema,
} from "./validation";

/**
 * User administration. Every action re-checks `canManageUsers`, which is
 * partners only — this is the most privileged surface in the portal.
 */

const BCRYPT_ROUNDS = 12;

export type AdminFormState = {
  errors?: Record<string, string>;
  message?: string;
  ok?: boolean;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createUser(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireCapability(canManageUsers);

  const parsed = userCreateSchema.safeParse({
    name: text(formData, "name"),
    email: text(formData, "email"),
    role: text(formData, "role"),
    password: text(formData, "password"),
    supervisorId: text(formData, "supervisorId"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const data = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });

  if (existing) {
    return { errors: { email: "An account with that email already exists." } };
  }

  if (data.supervisorId) {
    const supervisor = await prisma.user.findUnique({
      where: { id: data.supervisorId },
      select: { id: true },
    });
    if (!supervisor) {
      return { errors: { supervisorId: "That supervisor does not exist." } };
    }
  }

  await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      passwordHash: await hash(data.password, BCRYPT_ROUNDS),
      supervisorId: data.supervisorId,
    },
  });

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function updateUser(
  userId: string,
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await requireCapability(canManageUsers);

  const parsed = userUpdateSchema.safeParse({
    name: text(formData, "name"),
    role: text(formData, "role"),
    supervisorId: text(formData, "supervisorId"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const data = parsed.data;

  // Guard against a partner locking themselves out of administration.
  if (actor.id === userId) {
    if (!data.isActive) {
      return { message: "You cannot deactivate your own account." };
    }
    if (data.role !== "ADMIN_PARTNER") {
      return { message: "You cannot remove your own partner role." };
    }
  }

  // A supervisor chain that points at itself would make team queries loop.
  if (data.supervisorId === userId) {
    return { errors: { supervisorId: "Someone cannot supervise themselves." } };
  }

  if (data.supervisorId) {
    const supervisor = await prisma.user.findUnique({
      where: { id: data.supervisorId },
      select: { id: true, supervisorId: true },
    });
    if (!supervisor) {
      return { errors: { supervisorId: "That supervisor does not exist." } };
    }
    if (supervisor.supervisorId === userId) {
      return {
        errors: { supervisorId: "That would create a reporting loop." },
      };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      role: data.role,
      supervisorId: data.supervisorId,
      isActive: data.isActive,
    },
  });

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function resetUserPassword(
  userId: string,
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireCapability(canManageUsers);

  const parsed = passwordResetSchema.safeParse({
    password: text(formData, "password"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hash(parsed.data.password, BCRYPT_ROUNDS) },
  });

  revalidatePath("/settings/team");
  return { ok: true, message: "Password updated." };
}

/**
 * Deactivation rather than deletion: audit rows, uploaded documents and case
 * history all reference the user, and a firm needs that trail to survive
 * someone leaving.
 */
export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const actor = await requireCapability(canManageUsers);

  if (actor.id === userId && !isActive) {
    return { ok: false, message: "You cannot deactivate your own account." };
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  revalidatePath("/settings/team");
  return { ok: true };
}
