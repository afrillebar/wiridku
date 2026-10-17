import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/putrazea";
  // ponytail: only same-site admin paths, otherwise the next param is an open redirect
  const target = next.startsWith("/putrazea") ? next : "/putrazea";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${target}`);
  }
  return NextResponse.redirect(`${origin}/putrazea/login?error=${encodeURIComponent("Tautan tidak valid atau kedaluwarsa.")}`);
}
