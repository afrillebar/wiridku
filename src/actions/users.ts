"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { goto, text, type FormState } from "@/lib/form";

const BACK = "/putrazea/users";
const isRole = (v: string): v is "admin" | "editor" => v === "admin" || v === "editor";

export async function createStaff(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireAdmin();
  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const role = text(fd, "role");

  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Format email tidak valid." };
  if (password.length < 8) return { error: "Password minimal 8 karakter." };
  if (!isRole(role)) return { error: "Role tidak valid." };

  const service = createServiceClient();
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) return { error: created.error.message };

  const { error } = await service.from("profiles").insert({ user_id: created.data.user.id, email, role, is_active: true });
  if (error) {
    await service.auth.admin.deleteUser(created.data.user.id);
    return { error: error.message };
  }

  await audit(await createClient(), staff, "user", created.data.user.id, "create", { email, role });
  redirect(goto(BACK, { ok: `Akun ${email} dibuat sebagai ${role}.` }));
}

export async function setStaffRole(fd: FormData) {
  const staff = await requireAdmin();
  const id = text(fd, "id");
  const role = text(fd, "role");
  if (!isRole(role)) redirect(goto(BACK, { error: "Role tidak valid." }));
  if (id === staff.id) redirect(goto(BACK, { error: "Tidak bisa mengubah role akun sendiri." }));

  const { error } = await createServiceClient().from("profiles").update({ role }).eq("user_id", id);
  if (error) redirect(goto(BACK, { error: error.message }));

  await audit(await createClient(), staff, "user", id, "set-role", { role });
  redirect(goto(BACK, { ok: "Role diubah." }));
}

export async function setStaffActive(fd: FormData) {
  const staff = await requireAdmin();
  const id = text(fd, "id");
  const active = text(fd, "active") === "true";
  if (id === staff.id) redirect(goto(BACK, { error: "Tidak bisa menonaktifkan akun sendiri." }));

  const { error } = await createServiceClient().from("profiles").update({ is_active: active }).eq("user_id", id);
  if (error) redirect(goto(BACK, { error: error.message }));

  await audit(await createClient(), staff, "user", id, active ? "activate" : "deactivate");
  redirect(goto(BACK, { ok: active ? "Akun diaktifkan." : "Akun dinonaktifkan." }));
}

export async function resetStaffPassword(fd: FormData) {
  const staff = await requireAdmin();
  const id = text(fd, "id");
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) redirect(goto(BACK, { error: "Password minimal 8 karakter." }));

  const { error } = await createServiceClient().auth.admin.updateUserById(id, { password });
  if (error) redirect(goto(BACK, { error: error.message }));

  await audit(await createClient(), staff, "user", id, "reset-password");
  redirect(goto(BACK, { ok: "Password diganti." }));
}
