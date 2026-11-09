#!/bin/sh
# Guarda una clave secreta en .env.production sin mostrarla (no queda en pantalla, historial ni chat)
# y reinicia Feline para que la use.
# Desde tu Mac: ssh -t deploy@<IP> 'cd feline && scripts/deploy/set-secret.sh FELINE_ADMIN_TOKEN'
. "$(dirname "$0")/_common.sh"
KEY="${1:-}"
case "$KEY" in
  FELINE_ADMIN_TOKEN|FELINE_SESSION_SECRET|SPACES_ACCESS_KEY_ID|SPACES_SECRET_ACCESS_KEY) ;;
  FELINE_SII_PRODUCCION_AUTORIZADA|RESEND_API_KEY) ;;
  *) echo "Uso: scripts/deploy/set-secret.sh <CLAVE>"
     echo "Claves: FELINE_ADMIN_TOKEN FELINE_SESSION_SECRET SPACES_ACCESS_KEY_ID SPACES_SECRET_ACCESS_KEY"
     echo "        FELINE_SII_PRODUCCION_AUTORIZADA RESEND_API_KEY"
     echo "TENANT_VAULT_MASTER_KEY no se cambia con este script: cambiarla deja ilegibles los certificados guardados."
     exit 1 ;;
esac
stty -echo; printf 'Pega el valor de %s (no se verá) y presiona Enter: ' "$KEY"; read -r VALUE; stty echo; printf '\n'
VALUE=$(printf '%s' "$VALUE" | tr -d '[:space:]')
[ -n "$VALUE" ] || { echo "No se guardó: el valor está vacío."; exit 1; }
case "$VALUE" in *[!A-Za-z0-9_.+/=:-]*) echo "No se guardó: el valor tiene caracteres inesperados (por ejemplo \$ o comillas)."; exit 1 ;; esac

TMP=$(mktemp)
grep -v "^$KEY=" .env.production > "$TMP"
printf '%s=%s\n' "$KEY" "$VALUE" >> "$TMP"
cat "$TMP" > .env.production && rm -f "$TMP"
echo "Guardado $KEY. Reiniciando Feline…"
export APP_VERSION="${APP_VERSION:-$(cat .deployed-version 2>/dev/null || echo latest)}"
dc up -d --force-recreate app >/dev/null 2>&1
if health; then echo "OK: Feline ya usa la clave nueva."; else echo "Feline no responde: revisa docker compose logs --tail=100 app"; exit 1; fi
