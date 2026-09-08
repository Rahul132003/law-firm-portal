"use client";

import { useState } from "react";

import { buttonClass } from "@/components/ui/button";

export type ReportPayload = {
  firmName: string;
  generatedBy: string;
  generatedAt: string;
  scopeNote: string;
  summary: Array<{ label: string; value: string }>;
  casesPerAdvocate: Array<[string, string, string, string]>;
  hearingsThisWeek: Array<[string, string, string, string]>;
  overdueTasks: Array<[string, string, string, string]>;
};

/**
 * Client-side PDF generation.
 *
 * jsPDF and jspdf-autotable are imported dynamically so ~350KB of PDF
 * machinery is not in the initial bundle for a page most people only read.
 */
export function ExportPdfButton({ payload }: { payload: ReportPayload }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);

    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const marginX = 40;
      let y = 48;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(payload.firmName, marginX, y);

      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90, 100, 120);
      doc.text("Case Management — Firm Report", marginX, y);

      y += 14;
      doc.setFontSize(8);
      doc.text(
        `Generated ${payload.generatedAt} by ${payload.generatedBy}`,
        marginX,
        y,
      );

      y += 11;
      // The scope note matters: a senior advocate's report covers their team,
      // not the firm, and a PDF outlives the screen it was made on.
      doc.text(payload.scopeNote, marginX, y);

      y += 22;
      doc.setTextColor(20, 30, 45);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Summary", marginX, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [["Measure", "Value"]],
        body: payload.summary.map((row) => [row.label, row.value]),
        margin: { left: marginX, right: marginX },
        theme: "grid",
        headStyles: { fillColor: [43, 51, 72], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
      });

      const section = (
        title: string,
        head: string[],
        body: string[][],
        empty: string,
      ) => {
        const previous = (
          doc as unknown as { lastAutoTable?: { finalY: number } }
        ).lastAutoTable;
        let top = (previous?.finalY ?? y) + 26;

        // Start a new page rather than orphaning a heading at the bottom.
        if (top > 700) {
          doc.addPage();
          top = 48;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(20, 30, 45);
        doc.text(title, marginX, top);

        if (body.length === 0) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(120, 130, 150);
          doc.text(empty, marginX, top + 16);
          (
            doc as unknown as { lastAutoTable?: { finalY: number } }
          ).lastAutoTable = { finalY: top + 16 };
          return;
        }

        autoTable(doc, {
          startY: top + 8,
          head: [head],
          body,
          margin: { left: marginX, right: marginX },
          theme: "grid",
          headStyles: { fillColor: [43, 51, 72], fontSize: 9 },
          bodyStyles: { fontSize: 8.5 },
        });
      };

      section(
        "Cases per advocate",
        ["Advocate", "Role", "Open", "Total"],
        payload.casesPerAdvocate.map((r) => [...r]),
        "No case assignments.",
      );

      section(
        "Hearings this week",
        ["Date", "Case", "Court", "Purpose"],
        payload.hearingsThisWeek.map((r) => [...r]),
        "No hearings scheduled in the next seven days.",
      );

      section(
        "Overdue tasks",
        ["Due", "Task", "Assigned to", "Case"],
        payload.overdueTasks.map((r) => [...r]),
        "No overdue tasks.",
      );

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(140, 150, 170);
        doc.text(
          "Confidential — internal firm document. Contains privileged matter information.",
          marginX,
          820,
        );
        doc.text(`Page ${page} of ${pageCount}`, 520, 820);
      }

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`firm-report-${stamp}.pdf`);
    } catch (cause) {
      console.error("PDF generation failed", cause);
      setError("Could not generate the PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className={buttonClass("secondary", "sm")}
      >
        {busy ? "Preparing…" : "Export PDF"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
