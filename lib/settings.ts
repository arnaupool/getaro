import { cache } from "react";
import { createClient } from "./supabase/server";

/** Dirección pública de Admin → Sistema (migración 0012), o null si no se ha configurado */
export const getPublicUrl = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("public_url")
    .maybeSingle<{ public_url: string | null }>();
  return data?.public_url ?? null;
});
