# Despliegue

Cambios preparados en el repositorio local FELINE y en el checkout de FUGAR basado en 54ee4e952acfb567da359d5e78a932af09cd81a8. Aplicar el parche FUGAR-FELINE.patch a esa revisión o revisar diferencias antes de incorporar a otra rama.

En FUGAR configurar MOTOR_DTE_API_URL con la URL de FELINE terminada en /v1, MOTOR_DTE_API_KEY, MOTOR_DTE_WEBHOOK_SECRET, EMISOR_RUT y FUGAR_FELINE_STORE_ID. Mantener DTE_AUTO_EMIT=false durante configuración. En FELINE registrar el cliente emisor, scopes y URL del webhook /api/v1/billing/webhook. Validar el contrato, habilitación del emisor y el modelo de comprobantes antes de activar emisión automática. Mantener certificado, CAF y secreto fuera del código.

Los registros históricos que usaban otras claves se bloquean para conciliación. Confirmar el DTE previo antes de migrar un reintento.
