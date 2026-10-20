import type { NextRequest } from "next/server";
import { relativeRedirect } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Un formulario de otra web no puede cerrarte la sesión
  if (request.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403 });
  const supabase = await createClient();
  await supabase.auth.signOut();
  return relativeRedirect("/login");
}
