import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "editor";
export type Staff = { id: string; email: string; role: Role };

// Active profile row = access. A Supabase account without one is not staff.
export const getStaff = cache(async (): Promise<Staff | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;

  const { data: profile } = await supabase.from("profiles").select("role, is_active, email").eq("user_id", id).maybeSingle();
  if (!profile?.is_active) return null;
  return { id, email: profile.email ?? (data.claims.email as string) ?? "", role: profile.role as Role };
});

export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/putrazea/login");
  return staff;
}

export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "admin") redirect("/putrazea?error=" + encodeURIComponent("Hanya admin yang boleh melakukan ini."));
  return staff;
}
