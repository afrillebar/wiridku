"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { FormBusy } from "@/components/admin/busy";

export function ConfirmButton({
  message,
  className,
  children,
  busyLabel = "Memproses…",
}: {
  message: string;
  className?: string;
  children: ReactNode;
  busyLabel?: string;
}) {
  return (
    <>
      <FormBusy label={busyLabel} />
      <Submit className={className} message={message}>
        {children}
      </Submit>
    </>
  );
}

function Submit({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
