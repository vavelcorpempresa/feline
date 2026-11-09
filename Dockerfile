# Feline en producción (guía: docs/DESPLIEGUE.md). Se usa con docker-compose.yml y scripts/deploy/*.sh.
FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runner
WORKDIR /app
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production \
    PORT=3004 \
    FELINE_HOST=0.0.0.0

RUN addgroup --system --gid 1001 feline && adduser --system --uid 1001 --ingroup feline feline

# node_modules completo: incluye la CLI de Prisma para `prisma migrate deploy` (servicio migrate)
# y esbuild, que compila el panel al iniciar. La consola de administración queda en dist/admin
# (scripts/deploy/admin.sh).
COPY --from=builder --chown=feline:feline /app/package.json ./package.json
COPY --from=builder --chown=feline:feline /app/node_modules ./node_modules
COPY --from=builder --chown=feline:feline /app/dist ./dist
COPY --from=builder --chown=feline:feline /app/prisma ./prisma

USER feline
EXPOSE 3004

# /v1/salud responde 503 si la base de datos no está disponible
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/v1/salud || exit 1

# tini reenvía SIGTERM a Node: el despachador SII y los webhooks se detienen de forma ordenada.
# Las migraciones NO corren aquí: ver scripts/deploy/deploy.sh (servicio migrate).
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
