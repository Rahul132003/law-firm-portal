import type { Metadata } from "next";
import Link from "next/link";
import { CaseForm } from "@/components/cases/case-form";
import { canCreateCases } from "@/lib/auth/roles";
import { createCase } from "@/lib/cases/actions";
import { getAssignableStaff } from "@/lib/cases/queries";
import { getClientSuggestions } from "@/lib/clients/queries";
import { requireCapability } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";

export const metadata: Metadata = {
  title: `New case · ${FIRM_NAME}`,
};

export default async function NewCasePage() {
  // Throws 403 for associates and paralegals.
  const user = await requireCapability(canCreateCases);
  const [staff, clientSuggestions] = await Promise.all([
    getAssignableStaff(),
    getClientSuggestions(user),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      {" "}
      <nav className="mb-4 text-sm">
        <Link
          href="/cases"
          className="text-secondary underline-offset-2 hover:underline"
        >
          ← Cases
        </Link>
      </nav>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-primary">
        New case
      </h1>
      <CaseForm
        action={createCase}
        staff={staff}
        clientSuggestions={clientSuggestions}
        submitLabel="Create case"
        cancelHref="/cases"
        defaults={{
          caseNumber: "",
          title: "",
          clientName: "",
          caseType: "CIVIL",
          court: "",
          jurisdiction: "",
          judge: "",
          opposingParty: "",
          opposingCounsel: "",
          status: "FILED",
          filedOn: "",
          // Pre-seed the creator as lead counsel; they can remove themselves.
          assignments: [{ userId: user.id, roleOnCase: "LEAD_COUNSEL" }],
        }}
      />
    </div>
  );
}
