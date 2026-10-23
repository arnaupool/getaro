/**
 * Dirección externa escrita en Admin → Sistema, reducida a su origen ("https://getaro.example.com").
 * "" si se deja vacía (se usará la del navegador) y null si no es una dirección http(s) válida.
 */
export function normalizePublicUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return "";
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
  return url.origin;
}

/** Enlace para compartir: absoluto con la dirección pública o, sin ella, la ruta tal cual (le pone origen el navegador) */
export function shareLink(publicUrl: string | null, path: string): string {
  return publicUrl ? publicUrl + path : path;
}
