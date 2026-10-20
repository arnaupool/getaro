/** Hosts de los que se aceptan fotos de perfil (las de las cuentas de Google). */
const ALLOWED_AVATAR_HOSTS = ["lh3.googleusercontent.com"];

/**
 * URL de avatar segura o null. La foto la pone Google, pero cualquiera puede mandar otra URL al registrarse; sin este
 * filtro, una imagen de un servidor ajeno vería la IP de cada persona que abre la sala.
 */
export function safeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED_AVATAR_HOSTS.includes(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
}
