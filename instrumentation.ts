// Supabase (plan gratis) pausa el proyecto tras 7 días sin actividad. Mientras el servidor
// esté en marcha, hacemos una consulta ligera al arrancar y luego cada 24 h para mantenerlo despierto.

const DAY_MS = 24 * 60 * 60 * 1000;

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;

  const ping = async () => {
    try {
      const res = await fetch(`${url}/rest/v1/rooms?select=id&limit=1`, { headers: { apikey: key } });
      console.log(`[keepalive] Supabase ${res.status}`);
    } catch (error) {
      console.error("[keepalive] Supabase no responde:", (error as Error).message);
    }
  };

  void ping();
  setInterval(ping, DAY_MS).unref();
}
