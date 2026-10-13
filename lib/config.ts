// Configuración de Supabase leída en tiempo de ejecución (solo servidor).
// En Docker/Unraid: SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY. En local: también vale .env.local con NEXT_PUBLIC_*.

export type SupabaseConfig = { url: string; key: string };

export function supabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan las variables SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY");
  }
  return { url, key };
}
