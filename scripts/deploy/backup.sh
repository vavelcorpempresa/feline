#!/bin/sh
# Respaldo de la base de Feline (pg_dump formato custom): documentos, XML firmados, certificados y CAF
# (cifrados con TENANT_VAULT_MASTER_KEY, que NO va en el respaldo: guárdala aparte).
# Uso: scripts/deploy/backup.sh   (diario por cron; ver docs/DESPLIEGUE.md §6)
# Conserva 14 respaldos en el Droplet y, en el Space, 30 diarios y 72 mensuales (los DTE se conservan 6 años).
. "$(dirname "$0")/_common.sh"
TS=$(date +%Y%m%d-%H%M)
mkdir -p backups && chmod 700 backups
URL=$(envget DATABASE_URL)
# pg_dump debe ser de la misma versión mayor que el servidor
PGV=$(docker run --rm -e PGURL="$URL" postgres:17-alpine sh -c 'psql "$PGURL" -tAc "show server_version_num"' | cut -c1-2)
case "$PGV" in 1[3-9]) ;; *) echo "No se pudo leer la versión de PostgreSQL ($PGV). Revisa DATABASE_URL."; exit 1 ;; esac
# Si pg_dump falla, no dejar un respaldo vacío que parezca válido
trap 'rm -f "backups/feline-$TS.dump"' EXIT
docker run --rm --user "$(id -u):$(id -g)" -e PGURL="$URL" -v "$PWD/backups:/out" "postgres:$PGV-alpine" \
  sh -c 'pg_dump --format=custom --no-owner --no-acl "$PGURL" -f /out/feline-'"$TS"'.dump'
trap - EXIT
chmod 600 "backups/feline-$TS.dump"
ls -1t backups/feline-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "Respaldo listo: backups/feline-$TS.dump"

# Copia fuera del Droplet, en un Space privado de DigitalOcean (SPACES_* en .env.production)
BUCKET=$(envget SPACES_BUCKET)
if [ -n "$BUCKET" ]; then
  REGION=$(envget SPACES_REGION); REGION=${REGION:-nyc3}
  # Las claves van por variables de entorno (no en la línea de comandos, que verían otros procesos)
  AWS_ACCESS_KEY_ID=$(envget SPACES_ACCESS_KEY_ID); AWS_SECRET_ACCESS_KEY=$(envget SPACES_SECRET_ACCESS_KEY)
  export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
  s3() {
    docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION=us-east-1 \
      -v "$PWD/backups:/b:ro" amazon/aws-cli --endpoint-url "https://$REGION.digitaloceanspaces.com" s3 "$@"
  }
  s3 cp "/b/feline-$TS.dump" "s3://$BUCKET/feline/diarios/feline-$TS.dump" --only-show-errors
  # El primer respaldo de cada mes se guarda también como mensual
  MES=$(date +%Y%m)
  if ! s3 ls "s3://$BUCKET/feline/mensuales/feline-$MES" >/dev/null 2>&1; then
    s3 cp "/b/feline-$TS.dump" "s3://$BUCKET/feline/mensuales/feline-$MES.dump" --only-show-errors
  fi
  podar() {
    s3 ls "s3://$BUCKET/feline/$1/" | awk '{print $4}' | grep '^feline-' | sort -r | tail -n "+$(($2 + 1))" |
      while read -r key; do s3 rm "s3://$BUCKET/feline/$1/$key" --only-show-errors; done
  }
  podar diarios 30
  podar mensuales 72
  echo "Copia en el Space: s3://$BUCKET/feline/"
else
  echo "Aviso: SPACES_BUCKET vacío; el respaldo solo quedó en el Droplet."
fi
# Restaurar en una base VACÍA y distinta para probar:
#   docker run --rm -v "$PWD/backups:/in" postgres:<versión>-alpine pg_restore --no-owner --no-acl -d "<URL>" /in/feline-XXXX.dump
