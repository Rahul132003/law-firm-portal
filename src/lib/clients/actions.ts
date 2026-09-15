"use server";
import { revalidatePath } from "next/cache";

import { canCreateCases } from "@/lib/auth/roles";
import { fieldErrors } from "@/lib/cases/validation";
import { normalisePartyName } from "@/lib/conflicts/match";
import { requireCapability } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

import { getClientDetail } from "./queries";
import { clientUpdateSchema } from "./validation";

export type ClientFormState = {
  errors?: Record<string, string>;
  message?: string;
  ok?: boolean;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Edits a client's record. Limited to roles that open matters (partners and
 * senior advocates), and only for clients the caller can already see.
 *
 * A rename is written through to every linked case's display name, so the
 * conflict search — which reads case party names — sees the new name too.
 */
export async function updateClient(
  clientId: string,
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const user = await requireCapability(canCreateCases);

  const visible = await getClientDetail(user, clientId);
  if (!visible) return { message: "That client could not be found." };

  const parsed = clientUpdateSchema.safeParse({
    name: text(formData, "name"),
    kind: text(formData, "kind"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    address: text(formData, "address"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const data = parsed.data;
  const renamed = data.name !== visible.name;

  await prisma.$transaction([
    prisma.client.update({
      where: { id: clientId },
      data: {
        ...data,
        normalizedName: normalisePartyName(data.name) || data.name.toLowerCase(),
      },
    }),
    ...(renamed
      ? [
          prisma.case.updateMany({
            where: { clientId },
            data: { clientName: data.name },
          }),
        ]
      : []),
  ]);

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  if (renamed) revalidatePath("/cases");
  return { ok: true, message: "Client details saved." };
}
