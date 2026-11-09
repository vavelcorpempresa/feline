#!/bin/sh
# Despliega una versión: compila la imagen, respalda y aplica migraciones pendientes, reinicia y verifica salud.
# Uso:      scripts/deploy/deploy.sh 2026-11-10a
# Rollback: scripts/deploy/deploy.sh <versión-anterior>   (la imagen anterior sigue en el Droplet)
. "$(dirname "$0")/_common.sh"
V="${1:?Indica la versión, por ejemplo: scripts/deploy/deploy.sh $(date +%Y-%m-%d)a}"
export APP_VERSION="$V"

# Comprobaciones que evitan arrancar producción mal configurada
for k in DATABASE_URL TENANT_VAULT_MASTER_KEY FELINE_SESSION_SECRET FELINE_PUBLIC_URL FELINE_SII_MODO DOMAIN; do
  [ -n "$(envget $k)" ] || { echo "Falta $k en .env.production"; exit 1; }
done
[ "$(envget FELINE_SII_MODO)" = "simulado" ] && [ "$(envget FELINE_DEMO)" != "on" ] && {
  echo "FELINE_SII_MODO=simulado no se permite en producción (usa real)."; exit 1; }

if ! docker image inspect "feline-app:$V" >/dev/null 2>&1; then
  echo "== Compilando feline-app:$V (2 a 4 minutos)"
  git rev-parse --short HEAD 2>/dev/null | sed 's/^/   commit /' || true
  dc build app
fi

echo "== Migraciones"
PENDING=$(dc --profile ops run --rm migrate npx prisma migrate status 2>&1 || true)
if echo "$PENDING" | grep -qE "have not yet been applied|Database schema is empty"; then
  echo "$PENDING" | sed -n '/have not yet been applied/,/^$/p'
  if [ "${SKIP_BACKUP:-}" != "1" ] && ! echo "$PENDING" | grep -q "Database schema is empty"; then scripts/deploy/backup.sh; fi
  dc --profile ops run --rm migrate
else
  echo "   Sin migraciones pendientes."
fi

echo "== Iniciando la versión $V"
dc up -d app caddy
if health; then
  echo "OK: versión $V en línea."
  echo "$V" > .deployed-version
else
  echo "Feline no responde en /v1/salud. Revisa: docker compose logs --tail=100 app"
  [ -f .deployed-version ] && echo "Para volver atrás: scripts/deploy/deploy.sh $(cat .deployed-version)"
  exit 1
fi
