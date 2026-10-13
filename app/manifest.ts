import type { MetadataRoute } from "next";

// Permite instalar getaro en la pantalla de inicio del móvil (se abre a pantalla completa)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "getaro",
    short_name: "getaro",
    description: "Quadra quedades amb la teua colla",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#7c3aed",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
