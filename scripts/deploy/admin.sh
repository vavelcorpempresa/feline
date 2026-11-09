#!/bin/sh
# Consola de administración de Feline dentro del contenedor (misma que `npm run admin` en desarrollo).
# Ejemplos:
#   scripts/deploy/admin.sh proyecto:listar
#   scripts/deploy/admin.sh folios:sin-uso --rut 76192083-9
# Para archivos (certificado .pfx, CAF): usa la API /v1/plataforma (docs/API_NORMA.md §1), que no
# requiere copiar archivos al servidor.
. "$(dirname "$0")/_common.sh"
export APP_VERSION="${APP_VERSION:-$(cat .deployed-version 2>/dev/null || echo latest)}"
dc --profile ops run --rm admin "$@"
