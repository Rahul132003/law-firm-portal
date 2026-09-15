import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseForm } from "@/components/cases/case-form";
import { canEditCase } from "@/lib/auth/roles";
import { updateCase } from "@/lib/cases/actions";
import { getAssignableStaff, getCaseForEdit } from "@/lib/cases/queries";
import { getClientSuggestions } from "@/lib/clients/queries";
import { requireCapability } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";

export const metadata: Metadata = {
  title: `Edit case · ${FIRM_NAME}`,
};

/** `toISOString` would shift the date across timezones; format locally. */
function toDateInput(value: Date | null): string {
  if (!value) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export default async function EditCasePage(
  props: PageProps<"/cases/[id]/edit">,
) {
  const { id } = await props.params;

  const user = await requireCapability(canEditCase);
  const [record, staff, clientSuggestions] = await Promise.all([
    // Also performs the case-scope check.
    getCaseForEdit(id),
    getAssignableStaff(),
    getClientSuggestions(user),
  ]);

  if (!record) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      {" "}
      <nav className="mb-4 text-sm">
        <Link
          href={`/cases/${id}`}
          className="text-secondary underline-offset-2 hover:underline"
        >
          ← Back to case
        </Link>
      </nav>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-primary">
        Edit case
      </h1>
      <CaseForm
        action={updateCase.bind(null, id)}
        staff={staff}
        clientSuggestions={clientSuggestions}
        caseId={id}
        submitLabel="Save changes"
        cancelHref={`/cases/${id}`}
        defaults={{
          caseNumber: record.caseNumber,
          title: record.title,
          clientName: record.clientName,
          caseType: record.caseType,
          court: record.court,
          jurisdiction: record.jurisdiction,
          judge: record.judge ?? "",
          opposingParty: record.opposingParty ?? "",
          opposingCounsel: record.opposingCounsel ?? "",
          status: record.status,
          filedOn: toDateInput(record.filedOn),
          assignments: record.assignments,
        }}
      />
    </div>
  );
}
