import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

type Session =
  | { status: "ok"; profile: Profile }
  | { status: "anonymous" }
  | { status: "unavailable" } // Supabase no responde (caído o pausado)
  | { status: "no-profile" }; // sesión válida pero sin fila en profiles

/** Sesión actual. Deduplicada por request y sin redirecciones (la usa también la cabecera). */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error?.name === "AuthRetryableFetchError") return { status: "unavailable" };
  if (!user) return { status: "anonymous" };

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, color, is_admin")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (profileError) return { status: "unavailable" };
  if (!data) return { status: "no-profile" };
  return { status: "ok", profile: data };
});

/** Perfil de la sesión actual o null. */
export async function getProfile(): Promise<Profile | null> {
  const session = await getSession();
  return session.status === "ok" ? session.profile : null;
}

export async function requireProfile(): Promise<Profile> {
  const session = await getSession();
  if (session.status === "ok") return session.profile;
  if (session.status === "anonymous") redirect("/login");
  // Redirigir a /login aquí provocaría un bucle (el proxy ve la cookie y manda a "/")
  redirect(`/unavailable?reason=${session.status}`);
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.is_admin) redirect("/");
  return profile;
}
