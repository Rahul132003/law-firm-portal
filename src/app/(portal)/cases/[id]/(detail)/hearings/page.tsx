import { notFound } from "next/navigation";
import { HearingForm } from "@/components/hearings/hearing-form";
import { HearingList } from "@/components/hearings/hearing-list";
import { canManageHearings } from "@/lib/auth/roles";
import { getCaseDetail } from "@/lib/cases/queries";
import { listCaseHearings } from "@/lib/hearings/queries";
import { requireCaseAccess } from "@/lib/dal";
import { serverNowMs } from "@/lib/time";

export default async function CaseHearingsPage(
  props: PageProps<"/cases/[id]/hearings">,
) {
  const { id } = await props.params;
  const { user } = await requireCaseAccess(id);

  const [record, hearings] = await Promise.all([
    getCaseDetail(id),
    listCaseHearings(id),
  ]);

  if (!record) notFound();

  const canManage = canManageHearings(user.role);

  return (
    <div className="space-y-5">
      {canManage ? (
        <HearingForm caseId={id} defaultCourt={record.court} />
      ) : (
        <p className="rounded-lg border border-hairline bg-sunken px-3 py-2 text-xs text-secondary">
          Your role can view the court diary but not record hearings.
        </p>
      )}

      <HearingList
        caseId={id}
        canManage={canManage}
        defaultCourt={record.court}
        nowMs={serverNowMs()}
        hearings={hearings.map((hearing) => ({
          id: hearing.id,
          date: hearing.date,
          court: hearing.court,
          purpose: hearing.purpose,
          notes: hearing.notes,
          nextDate: hearing.nextDate,
        }))}
      />
    </div>
  );
}
