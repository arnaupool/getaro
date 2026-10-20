import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { relativeRedirect } from "@/lib/redirect";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

// Vuelta de Google OAuth (?code=) o del magic link (?code= con PKCE, o ?token_hash=&type=)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const safeNext = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  if (!ok) return relativeRedirect(`/login?error=1&next=${encodeURIComponent(safeNext)}`);
  return relativeRedirect(safeNext);
}
