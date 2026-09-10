"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonClass } from "@/components/ui/button";
import {
  acknowledgeNotice,
  createNotice,
  deleteNotice,
  updateNotice,
  type NoticeFormState,
} from "@/lib/notices/actions";

export type NoticeItem = {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: Date;
  postedBy: { id: string; name: string };
  readAt: Date | null;
  readCount: number;
  totalRecipients: number;
};

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-danger">{message}</p>;
}

function NoticeComposer({
  defaults,
  onDone,
}: {
  defaults?: { id: string; title: string; body: string; isPinned: boolean };
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(defaults));
  const [state, setState] = useState<NoticeFormState>({});
  const [pending, startTransition] = useTransition();

  const isEdit = Boolean(defaults);

  if (!open && !isEdit) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("primary", "sm")}
      >
        Post a notice
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const result = isEdit
            ? await updateNotice(defaults!.id, {}, formData)
            : await createNotice({}, formData);

          if (result.errors || result.message) {
            setState(result);
            return;
          }
          setState({});
          form.reset();
          if (isEdit) onDone?.();
          else setOpen(false);
          router.refresh();
        });
      }}
      className="card p-4"
    >
      <h3 className="text-sm font-semibold text-primary">
        {isEdit ? "Edit notice" : "Post a firm notice"}
      </h3>

      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor="notice-title" className="field-label">
            Title
          </label>
          <input
            id="notice-title"
            name="title"
            required
            defaultValue={defaults?.title ?? ""}
            disabled={pending}
            className="field-input"
            placeholder="Revised filing procedure, effective 1 October"
          />
          <FieldError message={state.errors?.title} />
        </div>

        <div>
          <label htmlFor="notice-body" className="field-label">
            Notice
          </label>
          <textarea
            id="notice-body"
            name="body"
            rows={5}
            required
            defaultValue={defaults?.body ?? ""}
            disabled={pending}
            className="field-input resize-y"
            placeholder="What everyone needs to know, and by when…"
          />
          <FieldError message={state.errors?.body} />
        </div>

        <label className="flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            name="isPinned"
            defaultChecked={defaults?.isPinned ?? false}
            disabled={pending}
          />
          Pin to the top of the board
        </label>
      </div>

      {state.message ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
        >
          {state.message}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-muted">
        Everyone active is notified. Editing later does not reset
        acknowledgements already given.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Post notice"}
        </button>
        <button
          type="button"
          onClick={() => (isEdit ? onDone?.() : setOpen(false))}
          className={buttonClass("secondary", "sm")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function NoticeBoard({
  notices,
  canPost,
}: {
  notices: NoticeItem[];
  canPost: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {canPost ? <NoticeComposer /> : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {notices.length === 0 ? (
        <p className="card px-6 py-10 text-center text-sm text-muted">
          No notices posted yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {notices.map((notice) => {
            if (editing === notice.id) {
              return (
                <li key={notice.id}>
                  <NoticeComposer
                    defaults={{
                      id: notice.id,
                      title: notice.title,
                      body: notice.body,
                      isPinned: notice.isPinned,
                    }}
                    onDone={() => {
                      setEditing(null);
                      router.refresh();
                    }}
                  />
                </li>
              );
            }

            const unread = notice.readAt === null;

            return (
              <li
                key={notice.id}
                className={`card p-5 ${unread ? "border-l-2 border-l-accent-600" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {notice.isPinned ? (
                        <span className="rounded-md bg-accent-50 px-1.5 py-0.5 text-[11px] font-medium text-accent-800">
                          Pinned
                        </span>
                      ) : null}
                      {unread ? (
                        <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-secondary">
                          Unread
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-1.5 text-base font-semibold text-primary">
                      {notice.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted">
                      {notice.postedBy.name} ·{" "}
                      {formatDateTime(notice.createdAt)}
                    </p>
                  </div>

                  {canPost ? (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/notices/${notice.id}/receipts`}
                        className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:bg-sunken hover:text-primary"
                      >
                        {notice.readCount}/{notice.totalRecipients} read
                      </Link>
                      <button
                        type="button"
                        onClick={() => setEditing(notice.id)}
                        className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:bg-sunken hover:text-primary"
                      >
                        Edit
                      </button>
                      {confirming === notice.id ? (
                        <>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                const result = await deleteNotice(notice.id);
                                setConfirming(null);
                                if (!result.ok) {
                                  setError(result.message ?? "Could not delete.");
                                } else {
                                  router.refresh();
                                }
                              })
                            }
                            className="rounded-md border border-danger/30 px-2 py-1 text-xs font-semibold text-danger"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(null)}
                            className="text-xs text-secondary hover:underline"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirming(notice.id)}
                          className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:border-danger/30 hover:text-danger"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm text-secondary">
                  {notice.body}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-hairline pt-3">
                  {unread ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await acknowledgeNotice(notice.id);
                          if (!result.ok) {
                            setError(result.message ?? "Could not record that.");
                          } else {
                            setError(null);
                            router.refresh();
                          }
                        })
                      }
                      className={buttonClass("primary", "sm")}
                    >
                      {pending ? "Recording…" : "I have read this"}
                    </button>
                  ) : (
                    <span className="text-xs text-success">
                      ✓ Acknowledged {formatDateTime(notice.readAt!)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
