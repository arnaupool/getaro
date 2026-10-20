const BASE = "http://getaro.local";

/**
 * Ruta interna a la que volver tras iniciar sesión. Cualquier otra cosa devuelve "/".
 * Comprobar solo que empieza por "/" no basta: el navegador convierte "/\evil.com" en "https://evil.com".
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || /[\\\u0000-\u001f]/.test(next)) return "/";
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
