import { CaseDocumentsPanel } from "@/components/documents/case-documents-panel";
import { DocumentFilters } from "@/components/documents/document-filters";
import type { DocumentCategory } from "@/generated/prisma/enums";
import { canDeleteDocuments } from "@/lib/auth/roles";
import { DOCUMENT_CATEGORY_ORDER } from "@/lib/documents/constants";
import { listCaseDocuments } from "@/lib/documents/queries";
import { requireCaseAccess } from "@/lib/dal";

function first(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single && single.trim() !== "" ? single : undefined;
}

export default async function CaseDocumentsPage(
  props: PageProps<"/cases/[id]/documents">,
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const { user } = await requireCaseAccess(id);

  const categoryParam = first(searchParams, "category");
  const documents = await listCaseDocuments(id, {
    category:
      categoryParam &&
      (DOCUMENT_CATEGORY_ORDER as readonly string[]).includes(categoryParam)
        ? (categoryParam as DocumentCategory)
        : undefined,
    q: first(searchParams, "q"),
  });

  return (
    <div>
      <DocumentFilters placeholder="Search this case's documents…" />

      <CaseDocumentsPanel
        caseId={id}
        canDelete={canDeleteDocuments(user.role)}
        documents={documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          fileName: doc.fileName,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          category: doc.category,
          version: doc.version,
          uploadedAt: doc.uploadedAt,
          uploadedBy: { name: doc.uploadedBy.name },
        }))}
      />
    </div>
  );
}
