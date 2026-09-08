"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_ORDER,
} from "@/lib/documents/constants";

/** Search and category filter, held in the URL so results are shareable. */
export function DocumentFilters({
  placeholder = "Search titles and filenames…",
}: {
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query) params.set("q", query);
      else params.delete("q");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(timer);
    // Excluding searchParams: including it would restart the debounce on the
    // very URL change this effect performs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, pathname, router]);

  function setCategory(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("category", value);
    else params.delete("category");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label="Search documents"
        className="field-input max-w-sm py-1.5 text-sm"
      />

      <select
        aria-label="Filter by category"
        value={searchParams.get("category") ?? ""}
        onChange={(event) => setCategory(event.target.value)}
        className="field-input max-w-[13rem] cursor-pointer py-1.5 text-sm"
      >
        <option value="">All categories</option>
        {DOCUMENT_CATEGORY_ORDER.map((option) => (
          <option key={option} value={option}>
            {DOCUMENT_CATEGORY_LABELS[option]}
          </option>
        ))}
      </select>

      <span
        aria-live="polite"
        className={`text-xs ${isPending ? "text-muted" : "sr-only"}`}
      >
        {isPending ? "Searching…" : ""}
      </span>
    </div>
  );
}
