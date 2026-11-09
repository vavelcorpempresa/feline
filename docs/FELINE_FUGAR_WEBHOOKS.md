# Webhooks

FELINE envía eventos documento.estado con x-firma, HMAC-SHA256 en hexadecimal sobre el cuerpo exacto. FUGAR valida el secreto y la firma antes de interpretar el JSON, acepta el evento de prueba y separa firmado de enviado. Los avisos atrasados no revierten estados terminales. Si llega un evento antes de que exista la asociación local, la respuesta 503 permite el reintento del despachador existente.

Pendiente: timestamp firmado, persistencia de IDs de eventos procesados, verificación de replay con ventana temporal y reconciliación automática.
