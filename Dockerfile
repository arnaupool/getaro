# syntax=docker/dockerfile:1

# ── 1. Dependencias ─────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── 2. Build ────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── 3. Imagen final ─────────────────────────────────────────
# Configuración en tiempo de ejecución (p. ej. desde la plantilla de Unraid):
#   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY y, opcional, TZ
FROM node:22-alpine AS runner
WORKDIR /app
# tzdata: "hoy" en el calendario y las validaciones debe ser el de España, no UTC
RUN apk add --no-cache tzdata
# Versión que muestra Admin > Sistema (la pasa GitHub Actions)
ARG GIT_SHA=""
ARG BUILD_DATE=""
ENV GIT_SHA=$GIT_SHA BUILD_DATE=$BUILD_DATE
ENV NODE_ENV=production     NEXT_TELEMETRY_DISABLED=1     PORT=3000     HOSTNAME=0.0.0.0     TZ=Europe/Madrid
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "server.js"]
