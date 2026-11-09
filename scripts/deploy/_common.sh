# Funciones compartidas por los scripts de despliegue. Se carga con: . "$(dirname "$0")/_common.sh"
set -eu
cd "$(dirname "$0")/../.."
[ -f .env.production ] || { echo "Falta .env.production (en el Droplet: cp .env.production.example .env.production y complétalo)."; exit 1; }
dc() { docker compose --env-file .env.production "$@"; }
# Lee una variable de .env.production sin ejecutar el archivo (quita comillas)
envget() { grep -E "^$1=" .env.production | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
health() {
  i=0
  while [ $i -lt 20 ]; do
    if curl -fsS http://127.0.0.1:3004/v1/salud >/dev/null 2>&1; then return 0; fi
    i=$((i + 1)); sleep 6
  done
  return 1
}
