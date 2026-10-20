"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({
  next,
  googleEnabled,
  devLogin,
}: {
  next: string;
  googleEnabled: boolean;
  devLogin: boolean;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const signInWithGoogle = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setStatus("error");
      setError(error.message);
    }
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) {
      setStatus("error");
      setError(
        error.status === 429
          ? t.login.rateLimit
          : error.name === "AuthRetryableFetchError"
            ? t.errors.network
            : error.message,
      );
    } else {
      setStatus("sent");
    }
  };

  // Alternativa al enlace: el código del correo funciona en cualquier navegador o dispositivo
  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    if (error) {
      setVerifying(false);
      setError(error.name === "AuthRetryableFetchError" ? t.errors.network : t.login.badCode);
      return;
    }
    window.location.assign(safeNextPath(next));
  };

  if (status === "sent") {
    return (
      <div className="text-center">
        <p className="text-4xl">📬</p>
        <p className="mt-3 font-medium">{t.login.checkEmail}</p>
        <p className="muted mt-1 text-sm">
          {t.login.sentTo} <strong className="break-all">{email}</strong>. {t.login.openSameBrowser}
        </p>
        <form onSubmit={verifyCode} className="mt-4 space-y-2 text-left">
          <label className="label" htmlFor="code">
            {t.login.code}
          </label>
          <div className="flex gap-2">
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              required
              className="input text-center font-mono tracking-widest"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <button type="submit" className="btn-primary" disabled={verifying || code.length < 6}>
              {verifying ? t.login.verifying : t.login.verify}
            </button>
          </div>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </form>
        <button
          className="btn-ghost mt-4"
          onClick={() => {
            setStatus("idle");
            setCode("");
            setError("");
          }}
        >
          {t.login.otherEmail}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {googleEnabled && (
        <>
          <button type="button" onClick={signInWithGoogle} className="btn-secondary w-full">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2z"
              />
              <path
                fill="#34A853"
                d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23z"
              />
              <path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.4-.4-2s.1-1.4.4-2V7.1H2a11 11 0 0 0 0 9.8L5.7 14z" />
              <path
                fill="#EA4335"
                d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2 7.1L5.7 10c.9-2.6 3.4-4.6 6.3-4.6z"
              />
            </svg>
            {t.login.google}
          </button>

          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            {t.login.or}
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </>
      )}

      <form onSubmit={sendMagicLink} className="space-y-3">
        <div>
          <label className="label" htmlFor="email">
            {t.login.email}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            placeholder={t.login.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={status === "sending"}>
          {status === "sending" ? t.login.sending : t.login.send}
        </button>
      </form>

      {status === "error" && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {devLogin && <DevLogin next={next} />}
    </div>
  );
}

/** Solo en `npm run dev`: entrar con usuarias de prueba creadas en Supabase (Authentication > Users > Add user). */
function DevLogin({ next }: { next: string }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setPending(false);
      setError(error.name === "AuthRetryableFetchError" ? t.errors.network : t.login.badCredentials);
      return;
    }
    window.location.assign(safeNextPath(next));
  };

  return (
    <details className="rounded-xl border border-dashed border-amber-400 p-3 dark:border-amber-600">
      <summary className="cursor-pointer text-xs font-medium text-amber-700 dark:text-amber-400">
        {t.login.devTitle}
      </summary>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <input
          type="email"
          required
          autoComplete="username"
          className="input"
          placeholder={t.login.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          className="input"
          placeholder={t.login.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="btn-secondary w-full" disabled={pending}>
          {pending ? t.login.verifying : t.login.devSubmit}
        </button>
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </form>
    </details>
  );
}
