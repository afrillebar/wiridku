import { createStaff, resetStaffPassword, setStaffActive, setStaffRole } from "@/actions/users";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { DataTable } from "@/components/admin/data-table";
import { Flash } from "@/components/admin/flash";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function UsersPage(props: PageProps<"/putrazea/users">) {
  const supabase = await createClient();
  const [me, { data: users }] = await Promise.all([
    requireAdmin(),
    supabase.from("profiles").select("user_id, email, role, is_active, created_at").order("created_at"),
  ]);

  return (
    <>
      <h1>Pengguna</h1>
      <Flash searchParams={props.searchParams} />
      <p className="muted">
        Admin: semua hak, termasuk menerbitkan, menghapus, dan mengelola pengguna. Editor: membuat dan mengedit draft, mengatur urutan dan aktif/nonaktif.
      </p>

      <DataTable
        colSpan={4}
        empty="Belum ada pengguna."
        head={
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        }
        rows={(users ?? []).map((u) => {
          const self = u.user_id === me.id;
          return (
            <tr key={u.user_id}>
              <td className="wide" data-label="Email">
                {u.email} {self && <span className="badge">Anda</span>}
              </td>
              <td data-label="Role">
                {self ? (
                  u.role
                ) : (
                  <form action={setStaffRole} className="inline">
                    <input type="hidden" name="id" value={u.user_id} />
                    <select name="role" defaultValue={u.role} aria-label={`Role ${u.email}`}>
                      <option value="admin">admin</option>
                      <option value="editor">editor</option>
                    </select>
                    <button type="submit" className="btn small">
                      Ubah
                    </button>
                  </form>
                )}
              </td>
              <td data-label="Status">{u.is_active ? "Aktif" : "Nonaktif"}</td>
              <td className="wide">
                <div className="row-actions">
                  {!self && (
                    <form action={setStaffActive}>
                      <input type="hidden" name="id" value={u.user_id} />
                      <input type="hidden" name="active" value={String(!u.is_active)} />
                      <ConfirmButton className="btn small" message={u.is_active ? "Nonaktifkan akun ini?" : "Aktifkan akun ini?"}>
                        {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </ConfirmButton>
                    </form>
                  )}
                  <form action={resetStaffPassword} className="inline">
                    <input type="hidden" name="id" value={u.user_id} />
                    <input name="password" type="password" minLength={8} placeholder="Password baru" autoComplete="new-password" aria-label={`Password baru ${u.email}`} />
                    <button type="submit" className="btn small">
                      Ganti password
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          );
        })}
      />

      <h2>Tambah pengguna</h2>
      <ActionForm action={createStaff} submitLabel="Buat akun">
        <div className="row">
          <label>
            Email
            <input name="email" type="email" required autoComplete="off" />
          </label>
          <label>
            Role
            <select name="role" defaultValue="editor">
              <option value="editor">editor</option>
              <option value="admin">admin</option>
            </select>
          </label>
        </div>
        <label>
          Password awal
          <input name="password" type="password" minLength={8} required autoComplete="new-password" />
          <small>Minimal 8 karakter. Sampaikan ke pengguna lewat kanal aman; mereka bisa menggantinya di menu Akun.</small>
        </label>
      </ActionForm>
    </>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = 'force-disabled';
