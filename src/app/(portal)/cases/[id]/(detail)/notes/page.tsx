import {
  NoteComposer,
  NoteList,
  type NoteView,
} from "@/components/cases/notes-panel";
import { canViewStrategyNotes, canWriteStrategyNotes } from "@/lib/auth/roles";
import { getCaseNotes } from "@/lib/cases/queries";
import { requireUser } from "@/lib/dal";

export default async function CaseNotesPage(
  props: PageProps<"/cases/[id]/notes">,
) {
  const { id } = await props.params;
  const user = await requireUser();

  // Already filtered by visibility for the caller's role, and decrypted.
  const notes = await getCaseNotes(id);

  const view: NoteView[] = notes.map((note) => ({
    id: note.id,
    body: note.body,
    visibility: note.visibility,
    createdAt: note.createdAt,
    author: { id: note.author.id, name: note.author.name },
    canDelete: note.author.id === user.id || user.role === "ADMIN_PARTNER",
  }));

  return (
    <div className="space-y-5">
      <NoteComposer
        caseId={id}
        canWriteStrategy={canWriteStrategyNotes(user.role)}
      />

      {!canViewStrategyNotes(user.role) ? (
        <p className="rounded-lg border border-hairline bg-sunken px-3 py-2 text-xs text-secondary">
          Strategy notes are not shown to your role. You are seeing case-team
          notes only.
        </p>
      ) : null}

      <NoteList notes={view} />
    </div>
  );
}
