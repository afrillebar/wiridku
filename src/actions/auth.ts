"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { text, type FormState } from "@/lib/form";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email dan password wajib diisi." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Email atau password salah." };

  const { data: profile } = await supabase.from("profiles").select("is_active").eq("user_id", data.user.id).maybeSingle();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: "Akun ini tidak punya akses admin." };
  }
  redirect("/putrazea");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/putrazea/login");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email");
  if (!email) return { error: "Email wajib diisi." };

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site}/auth/callback?next=/putrazea/akun` });
  // ponytail: same answer whether or not the email exists, so the form cannot be used to probe accounts
  return { ok: "Kalau email terdaftar, tautan reset password sudah dikirim." };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password minimal 8 karakter." };
  if (password !== confirm) return { error: "Konfirmasi password tidak sama." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: "Password diganti." };
}
