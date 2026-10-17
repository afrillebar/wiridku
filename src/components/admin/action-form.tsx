"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import { FormBusy } from "@/components/admin/busy";
import type { FormState } from "@/lib/form";

// ponytail: onSubmit instead of the form action prop, because React 19 resets uncontrolled fields after an action and would wipe the user's input on a validation error
export function ActionForm({
  action,
  submitLabel,
  children,
  className = "form",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, null);

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => run(fd));
      }}
    >
      <FormBusy label="Menyimpan…" />
      {state?.error && (
        <p className="msg error" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="msg ok" role="status">
          {state.ok}
        </p>
      )}
      {children}
      <div className="form-actions">
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "Menyimpan…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
