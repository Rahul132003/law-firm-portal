import type { Metadata } from "next";
import { DocumentFilters } from "@/components/documents/document-filters";
import { DocumentList } from "@/components/documents/document-list";
import type { DocumentCategory } from "@/generated/prisma/enums";
import { canDeleteDocuments } from "@/lib/auth/roles";
import { DOCUMENT_CATEGORY_ORDER } from "@/lib/documents/constants";
import {
  getDocumentCategoryCounts,
  searchDocuments,
} from "@/lib/documents/queries";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";

export const metadata: Metadata = {
  title: `Documents · ${FIRM_NAME}`,
};

function first(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single && single.trim() !== "" ? single : undefined;
}

export default async function DocumentsPage(props: PageProps<"/documents">) {
  const searchParams = await props.searchParams;
  const user = await requireUser();

  const categoryParam = first(searchParams, "category");
  const filters = {
    category:
      categoryParam &&
      (DOCUMENT_CATEGORY_ORDER as readonly string[]).includes(categoryParam)
        ? (categoryParam as DocumentCategory)
        : undefined,
    q: first(searchParams, "q"),
  };

  const [documents, counts] = await Promise.all([
    searchDocuments(user, filters),
    getDocumentCategoryCounts(user),
  ]);

  const total = counts.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="mx-auto max-w-5xl">
      {" "}
      <header className="mb-6">
        {" "}
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          Documents
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Search across every matter you have access to — {total} document
          {total === 1 ? "" : "s"} in total.
        </p>
      </header>
      <DocumentFilters placeholder="Search titles, filenames, case numbers…" />{" "}
      <p className="mb-2 text-xs text-muted">
        {" "}
        {documents.length} result{documents.length === 1 ? "" : "s"}{" "}
        {documents.length === 200 ? " (showing the first 200)" : ""}
      </p>
      <DocumentList
        showCase
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
          caseRef: {
            id: doc.case.id,
            caseNumber: doc.case.caseNumber,
            title: doc.case.title,
          },
        }))}
      />
    </div>
  );
}
