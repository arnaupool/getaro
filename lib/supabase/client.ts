import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseConfig } from "../config";

declare global {
  interface Window {
    /** Lo inyecta el layout raíz con la configuración leída en el servidor al arrancar */
    __SUPABASE__?: SupabaseConfig;
  }
}

function config(): SupabaseConfig {
  if (typeof window !== "undefined" && window.__SUPABASE__) return window.__SUPABASE__;
  // Render en servidor de un componente cliente
  return {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    key: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
  };
}

export function createClient() {
  const { url, key } = config();
  return createBrowserClient(url, key);
}
