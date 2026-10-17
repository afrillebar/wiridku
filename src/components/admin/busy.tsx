"use client";

import { useFormStatus } from "react-dom";

export function Busy({ label }: { label: string }) {
  return (
    <div className="busy" role="status" aria-live="polite">
      <div className="busy-card">
        <span className="busy-spin" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}

export function FormBusy({ label }: { label: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <Busy label={label} />;
}
