/**
 * Redirección con dirección relativa ("/login"). El navegador la completa con el dominio en el que ya está.
 * No usar request.url ni nextUrl.origin en route handlers: dentro de Docker valen http://0.0.0.0:3000.
 */
export function relativeRedirect(path: string, status: 303 | 307 = 303): Response {
  return new Response(null, { status, headers: { Location: path } });
}
