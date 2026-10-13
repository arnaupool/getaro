import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { I18nProvider } from "@/components/I18nProvider";
import { supabaseConfig } from "@/lib/config";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: "getaro",
    description: t.meta.description,
    // iPhone: "Afegir a la pantalla d'inici" abre la app sin barra del navegador
    appleWebApp: { capable: true, title: "getaro", statusBarStyle: "default" },
    icons: { apple: "/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

// Aplica el tema antes del primer pintado para evitar parpadeo
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale } = await getI18n();
  // Config pública de Supabase para el navegador, leída en tiempo de ejecución (no se incrusta al compilar)
  const clientConfig = `window.__SUPABASE__=${JSON.stringify(supabaseConfig()).replace(/</g, "\\u003c")}`;
  return (
    <html
      lang={locale === "ca" ? "ca-ES-valencia" : "es"}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: clientConfig }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider locale={locale}>
          <Header />
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {children}
          </main>
        </I18nProvider>
      </body>
    </html>
  );
}
