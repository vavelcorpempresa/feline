#!/bin/sh
# Sube el código de un commit al Droplet (el repositorio es privado: el servidor no lo clona).
# Se ejecuta en tu Mac, desde la carpeta de Feline:
#   scripts/deploy/subir.sh deploy@<IP>            sube HEAD
#   scripts/deploy/subir.sh deploy@<IP> <commit>   sube otro commit o rama
# Solo sube lo que está en git (nunca .env, respaldos ni archivos locales) y no toca en el servidor
# .env.production, backups/ ni .deployed-version. Después, en el servidor: scripts/deploy/deploy.sh <versión>
set -eu
DESTINO="${1:?Uso: scripts/deploy/subir.sh deploy@<IP> [commit]}"
REF="${2:-HEAD}"
cd "$(dirname "$0")/../.."
COMMIT=$(git rev-parse --short "$REF")
git diff --quiet "$REF" -- src prisma package.json package-lock.json Dockerfile docker-compose.yml deploy scripts 2>/dev/null ||
  echo "Aviso: hay cambios sin commit; se sube el commit $COMMIT, no tu copia de trabajo."
echo "== Subiendo $COMMIT a $DESTINO:feline"
git archive --format=tar "$REF" | ssh "$DESTINO" "mkdir -p feline && tar -x -C feline && echo $COMMIT > feline/.commit"
echo "Listo. En el servidor: cd feline && scripts/deploy/deploy.sh $(date +%Y-%m-%d)a"
