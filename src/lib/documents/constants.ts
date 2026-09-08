import type { DocumentCategory } from "@/generated/prisma/enums";

/** Client-safe display metadata and upload limits. */

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  PETITION: "Petition",
  REPLY: "Reply",
  EVIDENCE: "Evidence",
  ORDER: "Order",
  JUDGMENT: "Judgment",
  CORRESPONDENCE: "Correspondence",
  OTHER: "Other",
};

export const DOCUMENT_CATEGORY_ORDER: readonly DocumentCategory[] = [
  "PETITION",
  "REPLY",
  "EVIDENCE",
  "ORDER",
  "JUDGMENT",
  "CORRESPONDENCE",
  "OTHER",
] as const;

/** 25 MB. Scanned court records are routinely large. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Accepted document types. Deliberately a allowlist rather than a blocklist —
 * an unexpected type is refused rather than stored and served later.
 */
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "text/csv": "csv",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/tiff": "tiff",
};

export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_MIME_TYPES).join(",");

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
