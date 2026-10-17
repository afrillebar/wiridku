import { changePassword } from "@/actions/auth";
import { ActionForm } from "@/components/admin/action-form";
import { requireStaff } from "@/lib/auth";

export default async function AccountPage() {
  const staff = await requireStaff();
  return (
    <>
      <h1>Akun</h1>
      <p>
        {staff.email} · role <strong>{staff.role}</strong>
      </p>
      <h2>Ganti password</h2>
      <ActionForm action={changePassword} submitLabel="Ganti password">
        <label>
          Password baru
          <input name="password" type="password" minLength={8} required autoComplete="new-password" />
        </label>
        <label>
          Ulangi password baru
          <input name="confirm" type="password" minLength={8} required autoComplete="new-password" />
        </label>
      </ActionForm>
    </>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = 'force-disabled';
