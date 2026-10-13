import { relativeRedirect } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return relativeRedirect("/login");
}
