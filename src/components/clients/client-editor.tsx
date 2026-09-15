"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonClass } from "@/components/ui/button";
import { updateClient, type ClientFormState } from "@/lib/clients/actions";
import { CLIENT_KIND_LABELS } from "@/lib/clients/validation";

type ClientFields = {
  id: string;
  name: string;
  kind: "INDIVIDUAL" | "ORGANISATION";
  email: string | null;
  phone: string | null;
  address: string | null;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-danger">{message}</p>;
}

export function ClientEditor({ client, matterCount }: { client: ClientFields; matterCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ClientFormState>({});
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary", "sm")}>
          Edit details
        </button>
        {state.ok && state.message ? <span className="text-xs text-success">{state.message}</span> : null}
      </div>
    );
  }

  const errors = state.errors ?? {};

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await updateClient(client.id, {}, formData);
          setState(result);
          if (result.ok) {
            setOpen(false);
            router.refresh();
          }
        });
      }}
      className="card mt-4 p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="client-name" className="field-label">
            Name
          </label>
          <input id="client-name" name="name" defaultValue={client.name} required className="field-input" />
          {matterCount > 0 ? (
            <p className="mt-1 text-xs text-muted">
              Renaming updates the client name on {matterCount} linked matter{matterCount === 1 ? "" : "s"}.
            </p>
          ) : null}
          <FieldError message={errors.name} />
        </div>

        <div>
          <label htmlFor="client-kind" className="field-label">
            Type
          </label>
          <select id="client-kind" name="kind" defaultValue={client.kind} className="field-input cursor-pointer">
            {(Object.keys(CLIENT_KIND_LABELS) as Array<keyof typeof CLIENT_KIND_LABELS>).map((kind) => (
              <option key={kind} value={kind}>
                {CLIENT_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <FieldError message={errors.kind} />
        </div>

        <div>
          <label htmlFor="client-email" className="field-label">
            Email <span className="text-muted">(optional)</span>
          </label>
          <input id="client-email" name="email" type="email" defaultValue={client.email ?? ""} className="field-input" />
          <FieldError message={errors.email} />
        </div>

        <div>
          <label htmlFor="client-phone" className="field-label">
            Phone <span className="text-muted">(optional)</span>
          </label>
          <input id="client-phone" name="phone" type="tel" defaultValue={client.phone ?? ""} className="field-input" />
          <FieldError message={errors.phone} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="client-address" className="field-label">
            Address <span className="text-muted">(optional)</span>
          </label>
          <textarea id="client-address" name="address" rows={2} defaultValue={client.address ?? ""} className="field-input" />
          <FieldError message={errors.address} />
        </div>
      </div>

      {state.message && !state.ok ? (
        <p role="alert" className="mt-3 text-xs text-danger">
          {state.message}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("secondary", "sm")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
