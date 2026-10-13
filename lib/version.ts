/** Versión en marcha. GitHub Actions la pasa a la imagen Docker (GIT_SHA, BUILD_DATE); en local no hay. */
export function getVersion(): { sha: string; shortSha: string; builtAt: string | null } | null {
  const sha = process.env.GIT_SHA;
  if (!sha) return null;
  return { sha, shortSha: sha.slice(0, 7), builtAt: process.env.BUILD_DATE || null };
}
