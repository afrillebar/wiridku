import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requestPasswordReset, signIn } from "@/actions/auth";
import { ActionForm } from "@/components/admin/action-form";
import { Flash } from "@/components/admin/flash";
import { getStaff } from "@/lib/auth";
import { ThemeSwitch } from "@/components/admin/theme-switch";

export default function LoginPage(props: PageProps<"/putrazea/login">) {
  return (
    <main className="login">
      <h1>Wiridku</h1>
      <p className="muted">Masuk ke panel admin</p>
      <ThemeSwitch />
      <Suspense>
        <Gate />
        <Flash searchParams={props.searchParams} />
      </Suspense>
      <ActionForm action={signIn} submitLabel="Masuk">
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
      </ActionForm>
      <details className="reset">
        <summary>Lupa password?</summary>
        <ActionForm action={requestPasswordReset} submitLabel="Kirim tautan reset">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
        </ActionForm>
      </details>
    </main>
  );
}

// Already signed in as staff: skip the form.
async function Gate() {
  if (await getStaff()) redirect("/putrazea");
  return null;
}
