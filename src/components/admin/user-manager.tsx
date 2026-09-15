"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonClass } from "@/components/ui/button";
import type { Role } from "@/generated/prisma/enums";
import {
  createUser,
  resetUserPassword,
  setUserActive,
  updateUser,
  type AdminFormState,
} from "@/lib/admin/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/admin/validation";
import { ALL_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  supervisorId: string | null;
  supervisorName: string | null;
  caseCount: number;
  openTaskCount: number;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-danger">{message}</p>;
}

function RoleSelect({
  name,
  defaultValue,
  disabled,
}: {
  name: string;
  defaultValue: string;
  disabled?: boolean;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      disabled={disabled}
      className="field-input cursor-pointer"
    >
      {ALL_ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}

function SupervisorSelect({
  users,
  defaultValue,
  excludeId,
}: {
  users: ManagedUser[];
  defaultValue: string;
  excludeId?: string;
}) {
  return (
    <select
      name="supervisorId"
      defaultValue={defaultValue}
      className="field-input cursor-pointer"
    >
      <option value="">No supervisor</option>
      {users
        .filter((u) => u.id !== excludeId && u.isActive)
        .map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} — {ROLE_LABELS[u.role]}
          </option>
        ))}
    </select>
  );
}

function CreateUserForm({
  users,
  defaultOpen = false,
}: {
  users: ManagedUser[];
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [state, setState] = useState<AdminFormState>({});
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("primary", "sm")}
      >
        Add a user
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
          const result = await createUser({}, formData);
          if (result.errors || result.message) {
            setState(result);
            return;
          }
          setState({});
          form.reset();
          setOpen(false);
          router.refresh();
        });
      }}
      className="card p-4"
    >
      <h3 className="text-sm font-semibold text-primary">Add a user</h3>
      <p className="mt-0.5 text-xs text-secondary">
        There is no self-service sign-up — accounts are issued here.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="new-name" className="field-label">
            Full name
          </label>
          <input
            id="new-name"
            name="name"
            required
            disabled={pending}
            className="field-input"
          />
          <FieldError message={state.errors?.name} />
        </div>

        <div>
          <label htmlFor="new-email" className="field-label">
            Email
          </label>
          <input
            id="new-email"
            name="email"
            type="email"
            required
            disabled={pending}
            className="field-input"
          />
          <FieldError message={state.errors?.email} />
        </div>

        <div>
          <label htmlFor="new-role" className="field-label">
            Role
          </label>
          <RoleSelect name="role" defaultValue="ASSOCIATE" disabled={pending} />
          <FieldError message={state.errors?.role} />
        </div>

        <div>
          <label htmlFor="new-supervisor" className="field-label">
            Supervisor <span className="text-muted">(optional)</span>
          </label>
          <SupervisorSelect users={users} defaultValue="" />
          <FieldError message={state.errors?.supervisorId} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="new-password" className="field-label">
            Initial password
          </label>
          <input
            id="new-password"
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            disabled={pending}
            className="field-input"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          />
          <p className="mt-1 text-xs text-muted">
            Share it over a channel the person already trusts, and ask them to
            change it. There is no password-reset email yet.
          </p>
          <FieldError message={state.errors?.password} />
        </div>
      </div>

      {state.message ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
        >
          {state.message}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "Creating…" : "Create user"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={buttonClass("secondary", "sm")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditUserRow({
  target,
  users,
  currentUserId,
  onDone,
}: {
  target: ManagedUser;
  users: ManagedUser[];
  currentUserId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<AdminFormState>({});
  const [pwState, setPwState] = useState<AdminFormState>({});
  const [pending, startTransition] = useTransition();

  const isSelf = target.id === currentUserId;

  return (
    <li className="card p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await updateUser(target.id, {}, formData);
            if (result.errors || result.message) {
              setState(result);
              return;
            }
            setState({});
            onDone();
            router.refresh();
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label">Name</label>
            <input
              name="name"
              defaultValue={target.name}
              required
              disabled={pending}
              className="field-input"
            />
            <FieldError message={state.errors?.name} />
          </div>

          <div>
            <label className="field-label">Email</label>
            <input
              value={target.email}
              readOnly
              disabled
              className="field-input opacity-60"
            />
            <p className="mt-1 text-xs text-muted">
              Email is the login identity and cannot be changed here.
            </p>
          </div>

          <div>
            <label className="field-label">Role</label>
            <RoleSelect
              name="role"
              defaultValue={target.role}
              disabled={pending}
            />
            <FieldError message={state.errors?.role} />
          </div>

          <div>
            <label className="field-label">Supervisor</label>
            <SupervisorSelect
              users={users}
              defaultValue={target.supervisorId ?? ""}
              excludeId={target.id}
            />
            <FieldError message={state.errors?.supervisorId} />
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={target.isActive}
            disabled={pending || isSelf}
          />
          Active — can sign in
          {isSelf ? (
            <span className="text-xs text-muted">
              (you cannot deactivate yourself)
            </span>
          ) : null}
        </label>

        {state.message ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className={buttonClass("primary", "sm")}
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className={buttonClass("secondary", "sm")}
          >
            Cancel
          </button>
        </div>
      </form>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const formData = new FormData(form);
          startTransition(async () => {
            const result = await resetUserPassword(target.id, {}, formData);
            setPwState(result);
            if (result.ok) form.reset();
          });
        }}
        className="mt-4 border-t border-hairline pt-4"
      >
        <label className="field-label">Set a new password</label>
        <div className="flex flex-wrap items-start gap-2">
          <input
            name="password"
            type="password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            disabled={pending}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            className="field-input max-w-xs"
          />
          <button
            type="submit"
            disabled={pending}
            className={buttonClass("secondary", "sm")}
          >
            Reset password
          </button>
        </div>
        <FieldError message={pwState.errors?.password} />
        {pwState.ok && pwState.message ? (
          <p className="mt-1 text-xs text-success">{pwState.message}</p>
        ) : null}
      </form>
    </li>
  );
}

export function UserManager({
  users,
  currentUserId,
  defaultCreateOpen = false,
}: {
  users: ManagedUser[];
  currentUserId: string;
  /** Opens the create form on first render, for `?new=1` deep links. */
  defaultCreateOpen?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <CreateUserForm users={users} defaultOpen={defaultCreateOpen} />

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <ul className="space-y-2">
        {users.map((person) =>
          editing === person.id ? (
            <EditUserRow
              key={person.id}
              target={person}
              users={users}
              currentUserId={currentUserId}
              onDone={() => setEditing(null)}
            />
          ) : (
            <li key={person.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-primary">
                      {person.name}
                    </span>
                    <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-secondary">
                      {ROLE_LABELS[person.role]}
                    </span>
                    {!person.isActive ? (
                      <span className="rounded-md bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger">
                        Deactivated
                      </span>
                    ) : null}
                    {person.id === currentUserId ? (
                      <span className="text-[11px] text-muted">(you)</span>
                    ) : null}
                  </div>

                  <p className="mt-1 text-xs text-secondary">{person.email}</p>
                  <p className="text-xs text-muted">
                    {ROLE_DESCRIPTIONS[person.role]}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {person.caseCount} case
                    {person.caseCount === 1 ? "" : "s"} ·{" "}
                    {person.openTaskCount} open task
                    {person.openTaskCount === 1 ? "" : "s"}
                    {person.supervisorName
                      ? ` · reports to ${person.supervisorName}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(person.id)}
                    className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:bg-sunken hover:text-primary"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending || person.id === currentUserId}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await setUserActive(
                          person.id,
                          !person.isActive,
                        );
                        if (!result.ok) {
                          setError(result.message ?? "Could not update.");
                        } else {
                          setError(null);
                          router.refresh();
                        }
                      })
                    }
                    className="rounded-md border border-hairline px-2 py-1 text-xs text-secondary hover:bg-sunken hover:text-primary disabled:opacity-50"
                  >
                    {person.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
