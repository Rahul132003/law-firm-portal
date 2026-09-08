import type { DocumentCategory } from "@/generated/prisma/enums";

/**
 * Filename-based auto-categorisation.
 *
 * This is a convenience that pre-selects the category in the upload form, not
 * an authority — the uploader can always override it, and the override is
 * what gets stored. Ordering matters: the first matching rule wins, so more
 * specific terms are listed before the general ones they contain.
 */
const RULES: ReadonlyArray<{
  category: DocumentCategory;
  patterns: readonly RegExp[];
}> = [
  {
    category: "JUDGMENT",
    patterns: [
      /\bjudgm?ent\b/,
      /\bdecree\b/,
      /\bverdict\b/,
      /\bfinal[\s_-]?order\b/,
    ],
  },
  {
    category: "ORDER",
    patterns: [/\border\b/, /\bdirection\b/, /\binterim\b/, /\binjunction\b/],
  },
  {
    category: "PETITION",
    patterns: [
      /\bpetition\b/,
      /\bplaint\b/,
      /\bcomplaint\b/,
      /\bapplication\b/,
      /\bwrit\b/,
      /\bappeal\b/,
    ],
  },
  {
    category: "REPLY",
    patterns: [
      /\breply\b/,
      /\brejoinder\b/,
      /\bcounter\b/,
      /\bwritten[\s_-]?statement\b/,
      /\bresponse\b/,
      /\bobjection/,
    ],
  },
  {
    category: "EVIDENCE",
    patterns: [
      /\bevidence\b/,
      /\bexhibit\b/,
      /\baffidavit\b/,
      /\bdeposition\b/,
      /\bwitness\b/,
      /\bannexure\b/,
      /\bstatement\b/,
    ],
  },
  {
    category: "CORRESPONDENCE",
    patterns: [
      /\bletter\b/,
      /\bemail\b/,
      /\bnotice\b/,
      /\bmemo\b/,
      /\bcorrespondence\b/,
    ],
  },
];

/**
 * Guesses a category from a filename. Returns OTHER when nothing matches,
 * which is the honest answer rather than a misleading guess.
 */
export function categorizeFileName(fileName: string): DocumentCategory {
  // Separators become spaces so `\b` anchors work on `reply_draft.pdf`.
  const haystack = fileName
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[_\-.]+/g, " ");

  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      return rule.category;
    }
  }

  return "OTHER";
}

/** Strips a file extension for use as a default document title. */
export function titleFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[a-z0-9]+$/i, "");
  return withoutExtension.replace(/[_-]+/g, " ").trim() || fileName;
}
