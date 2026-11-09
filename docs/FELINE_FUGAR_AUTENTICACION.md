# Autenticación

La API existente usa un Bearer por cliente y empresa, con scopes documentos:emitir, documentos:leer y empresa:leer. FELINE guarda el hash y verifica que cliente y empresa estén activos. La llamada de emisión desde FUGAR exige HTTPS en producción, tiene timeout y rechaza redirecciones. MOTOR_DTE_API_KEY se configura solo en servidor.

FUGAR_FELINE_STORE_ID y EMISOR_RUT deben corresponder a la tienda y al emisor jurídicamente habilitado. No cambiar la identidad del cliente FELINE en un reintento. Para una rotación, mantener su registro y su historial de idempotencia.
