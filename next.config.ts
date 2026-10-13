import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autocontenido para la imagen Docker (node server.js sin node_modules completos)
  output: "standalone",
};

export default nextConfig;
