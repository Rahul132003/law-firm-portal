"use server";

import { revalidatePath } from "next/cache";

import { canPostNotices } from "@/lib/auth/roles";
import { requireCapability, requireUser } from "@/lib/dal";
import { deliver } from "@/lib/notifications/deliver";
import { prisma } from "@/lib/prisma";

import { fieldErrors, noticeInputSchema } from "./validation";

export type NoticeFormState = {
  errors?: Record<string, string>;
  message?: string;
  ok?: boolean;
};

function readForm(formData: FormData) {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  return {
    title: text("title"),
    body: text("body"),
    isPinned: formData.get("isPinned") === "on",
  };
}

export async function createNotice(
  _prev: NoticeFormState,
  formData: FormData,
): Promise<NoticeFormState> {
  const user = await requireCapability(canPostNotices);

  const parsed = noticeInputSchema.safeParse(readForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const notice = await prisma.notice.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      isPinned: parsed.data.isPinned,
      postedById: user.id,
    },
    select: { id: true, title: true },
  });

  // Tell everyone active except the author, who already knows.
  const recipients = await prisma.user.findMany({
    where: { isActive: true, id: { not: user.id } },
    select: { id: true },
  });

  for (const recipient of recipients) {
    await deliver({
      userId: recipient.id,
      kind: "NOTICE_POSTED",
      title: `Notice: ${notice.title}`,
      body: `${user.name} posted a firm notice. Open the notice board to acknowledge it.`,
      linkUrl: "/notices",
    });
  }

  revalidatePath("/notices");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateNotice(
  noticeId: string,
  _prev: NoticeFormState,
  formData: FormData,
): Promise<NoticeFormState> {
  await requireCapability(canPostNotices);

  const parsed = noticeInputSchema.safeParse(readForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const existing = await prisma.notice.findUnique({
    where: { id: noticeId },
    select: { id: true },
  });
  if (!existing) return { message: "That notice no longer exists." };

  // Editing does NOT clear existing receipts. An acknowledgement records that
  // someone read what was posted; silently resetting it would misrepresent
  // who has seen what. Material changes warrant a new notice.
  await prisma.notice.update({
    where: { id: noticeId },
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      isPinned: parsed.data.isPinned,
    },
  });

  revalidatePath("/notices");
  return { ok: true };
}

export async function deleteNotice(
  noticeId: string,
): Promise<{ ok: boolean; message?: string }> {
  await requireCapability(canPostNotices);

  // NoticeRead rows cascade with the notice.
  await prisma.notice.delete({ where: { id: noticeId } });

  revalidatePath("/notices");
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Records an explicit acknowledgement.
 *
 * Deliberately NOT automatic on page view: a receipt that only proves the
 * page rendered is worthless as evidence that someone actually read a firm
 * announcement. The reader has to say so.
 */
export async function acknowledgeNotice(
  noticeId: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();

  const notice = await prisma.notice.findUnique({
    where: { id: noticeId },
    select: { id: true },
  });
  if (!notice) return { ok: false, message: "That notice no longer exists." };

  // Idempotent: the unique (noticeId, userId) makes a second click a no-op
  // and preserves the original timestamp.
  await prisma.noticeRead.upsert({
    where: { noticeId_userId: { noticeId, userId: user.id } },
    update: {},
    create: { noticeId, userId: user.id },
  });

  revalidatePath("/notices");
  return { ok: true };
}
