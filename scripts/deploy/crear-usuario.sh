#!/bin/sh
# Crea un usuario del panel /finanzas. La contraseña se escribe aquí, oculta: no queda en pantalla,
# historial, registros ni en la línea de comandos de Docker.
# Desde tu Mac: ssh -t deploy@<IP> 'cd feline && scripts/deploy/crear-usuario.sh'
# La empresa debe existir antes (POST /v1/plataforma/empresas o la consola de administración).
. "$(dirname "$0")/_common.sh"
export APP_VERSION="${APP_VERSION:-$(cat .deployed-version 2>/dev/null || echo latest)}"
printf 'RUT de la empresa (ej. 76192083-9): '; read -r FELINE_FINANCE_RUT
printf 'Nombre de la persona: '; read -r FELINE_FINANCE_NAME
printf 'Correo (será el usuario): '; read -r FELINE_FINANCE_EMAIL
printf 'Rol [OWNER, ACCOUNTANT, BILLING, VIEWER] (OWNER): '; read -r FELINE_FINANCE_ROLE
FELINE_FINANCE_ROLE=${FELINE_FINANCE_ROLE:-OWNER}
stty -echo
printf 'Contraseña (mínimo 12 caracteres, no se verá): '; read -r FELINE_FINANCE_PASSWORD; printf '\n'
printf 'Repite la contraseña: '; read -r REPETIDA; printf '\n'
stty echo
[ "$FELINE_FINANCE_PASSWORD" = "$REPETIDA" ] || { echo "Las contraseñas no coinciden. No se creó el usuario."; exit 1; }
[ ${#FELINE_FINANCE_PASSWORD} -ge 12 ] || { echo "La contraseña debe tener al menos 12 caracteres."; exit 1; }
export FELINE_FINANCE_RUT FELINE_FINANCE_NAME FELINE_FINANCE_EMAIL FELINE_FINANCE_ROLE FELINE_FINANCE_PASSWORD
# -e NOMBRE sin valor: Docker toma el valor del entorno, sin escribirlo en la línea de comandos
dc --profile ops run --rm --entrypoint node \
  -e FELINE_FINANCE_RUT -e FELINE_FINANCE_NAME -e FELINE_FINANCE_EMAIL -e FELINE_FINANCE_ROLE -e FELINE_FINANCE_PASSWORD \
  admin dist/admin/finance-user.js
echo "Entra en $(envget FELINE_PUBLIC_URL)/finanzas con ese correo y contraseña."
