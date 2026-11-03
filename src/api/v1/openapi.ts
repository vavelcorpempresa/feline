// ============================================================================
// ESPECIFICACIÓN OPENAPI 3 DE LA API v1 (servida en GET /v1/openapi.json)
// Mantener sincronizada con documentos.routes.ts y api-documentos.service.ts.
// ============================================================================

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: unknown) => ({ 'application/json': { schema } });
const error = (descripcion: string) => ({ description: descripcion, content: json(ref('Error')) });

export function buildOpenApiSpec(publicBaseUrl: string) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Feline API',
      version: '1.0.0',
      description:
        'Motor DTE y ERP central. Cada proyecto se conecta con su propia clave (`Authorization: Bearer flk_...`), ' +
        'que pertenece a una empresa emisora y tiene permisos (scopes). Los cambios de estado de los documentos ' +
        'se avisan por webhook firmado con HMAC-SHA256 (cabecera `x-firma`, hex del cuerpo exacto).',
    },
    servers: [{ url: publicBaseUrl }],
    security: [{ bearer: [] }],
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer', description: 'Clave de proyecto flk_...' } },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: { error: { type: 'string' }, detalles: {} },
        },
        Item: {
          type: 'object',
          required: ['nombre', 'cantidad', 'precio'],
          properties: {
            nombre: { type: 'string', maxLength: 80 },
            cantidad: { type: 'number', exclusiveMinimum: 0 },
            precio: {
              type: 'number',
              minimum: 0,
              description: 'Factura y notas: precio NETO unitario. Boleta: precio FINAL con IVA incluido.',
            },
            exento: { type: 'boolean', default: false },
            codigo: { type: 'string', maxLength: 35 },
            unidad: { type: 'string', maxLength: 4 },
            descripcion: { type: 'string', maxLength: 1000 },
          },
        },
        Referencia: {
          type: 'object',
          required: ['tipo', 'folio'],
          properties: {
            tipo: {
              type: 'string',
              description: "Código SII ('33', '801', 'HES'...) o alias: 'OC' (801), 'PED'/'NP' (802), 'CONTRATO' (803).",
            },
            folio: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
            fecha: { type: 'string', format: 'date' },
            codRef: { type: 'integer', enum: [1, 2, 3], description: '1 anula, 2 corrige texto, 3 corrige montos' },
            razon: { type: 'string', maxLength: 90 },
          },
        },
        DocumentoRequest: {
          type: 'object',
          required: ['tipoDte', 'emisor', 'receptor', 'items'],
          properties: {
            tipoDte: { type: 'integer', enum: [33, 34, 39, 41, 56, 61] },
            referenciaExterna: {
              type: 'string',
              maxLength: 100,
              description: 'Id del documento en tu proyecto (ej. pedido). Se puede filtrar al listar.',
            },
            fechaEmision: { type: 'string', format: 'date', description: 'Por defecto hoy (hora de Chile)' },
            fechaVencimiento: { type: 'string', format: 'date' },
            formaPago: { type: 'integer', enum: [1, 2, 3], description: '1 contado, 2 crédito, 3 sin costo' },
            emisor: {
              type: 'object',
              required: ['rut'],
              description: 'Debe ser el RUT de la empresa de la clave (si no, 403).',
              properties: { rut: { type: 'string', example: '76192083-9' } },
            },
            receptor: {
              type: 'object',
              required: ['rut', 'razonSocial'],
              description: 'Factura y notas exigen giro, dirección y comuna. Boleta a consumidor final: RUT 66666666-6.',
              properties: {
                rut: { type: 'string' },
                razonSocial: { type: 'string' },
                giro: { type: 'string' },
                direccion: { type: 'string' },
                comuna: { type: 'string' },
                ciudad: { type: 'string' },
                correo: { type: 'string' },
                contacto: { type: 'string' },
              },
            },
            items: { type: 'array', minItems: 1, items: ref('Item') },
            referencias: { type: 'array', items: ref('Referencia') },
          },
        },
        Documento: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tipoDte: { type: 'integer' },
            folio: { type: 'integer' },
            estado: {
              type: 'string',
              enum: ['FIRMADO', 'EN_LOTE', 'ENVIADO', 'ACEPTADO', 'ACEPTADO_CON_REPARO', 'RECHAZADO', 'ANULADO'],
            },
            referenciaExterna: { type: 'string' },
            glosa: { type: 'string' },
            trackId: { type: 'string' },
            fechaEmision: { type: 'string', format: 'date' },
            montoNeto: { type: 'integer' },
            montoExento: { type: 'integer' },
            iva: { type: 'integer' },
            montoTotal: { type: 'integer' },
            xmlUrl: { type: 'string' },
            pdfUrl: { type: 'string' },
          },
        },
        WebhookEvento: {
          description:
            'POST a la URL del proyecto. Verificar `x-firma` = HMAC-SHA256(hex) del cuerpo exacto con el secreto del proyecto. ' +
            'Responder 2xx; si no, se reintenta con espera creciente (30 s ... 6 h, 12 intentos).',
          allOf: [
            ref('Documento'),
            {
              type: 'object',
              properties: { evento: { type: 'string', enum: ['documento.estado', 'webhook.prueba'] } },
            },
          ],
        },
      },
    },
    paths: {
      '/v1/empresa': {
        get: {
          summary: 'Empresa de la clave, certificado vigente, folios disponibles y folios por anular ante el SII',
          responses: { '200': { description: 'OK' }, '401': error('Clave inválida') },
        },
      },
      '/v1/documentos': {
        post: {
          summary: 'Emitir un documento tributario (idempotente)',
          parameters: [
            {
              name: 'Idempotency-Key',
              in: 'header',
              required: true,
              schema: { type: 'string', maxLength: 200 },
              description: 'Estable por documento: reintentar con la misma clave no emite dos veces.',
            },
          ],
          requestBody: { required: true, content: json(ref('DocumentoRequest')) },
          responses: {
            '202': { description: 'Emitido y enviado de inmediato al SII (ENVIADO con trackId). Si el SII no responde en 10 s o falla, FIRMADO y se reintenta automáticamente.', content: json(ref('Documento')) },
            '200': { description: 'Ya emitido con esta Idempotency-Key (idempotente: true)', content: json(ref('Documento')) },
            '400': error('Payload inválido'),
            '401': error('Clave inválida'),
            '403': error('Sin permiso o RUT emisor distinto al de la clave'),
            '409': error('Emisión en curso con la misma clave'),
            '422': error('Regla de negocio (sin folios CAF, certificado vencido, clave reutilizada con otro contenido...)'),
          },
        },
        get: {
          summary: 'Listar documentos (más recientes primero)',
          parameters: [
            { name: 'tipoDte', in: 'query', schema: { type: 'integer' } },
            { name: 'estado', in: 'query', schema: { type: 'string' } },
            { name: 'referenciaExterna', in: 'query', schema: { type: 'string' } },
            { name: 'desde', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'hasta', in: 'query', schema: { type: 'string', format: 'date' } },
            {
              name: 'todos',
              in: 'query',
              schema: { type: 'string', enum: ['true', 'false'] },
              description: 'true incluye documentos de otros proyectos de la misma empresa',
            },
            { name: 'limite', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'cursor', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: '{ datos: Documento[], siguienteCursor: string | null }' } },
        },
      },
      '/v1/documentos/{id}': {
        get: {
          summary: 'Estado de un documento',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': { description: 'OK', content: json(ref('Documento')) }, '404': error('No encontrado') },
        },
      },
      '/v1/documentos/{id}/pdf': {
        get: {
          summary: 'Representación impresa (PDF con timbre PDF417)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': { description: 'application/pdf' } },
        },
      },
      '/v1/documentos/{id}/xml': {
        get: {
          summary: 'XML del DTE firmado (ISO-8859-1)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': { description: 'application/xml' } },
        },
      },
      '/v1/webhooks/prueba': {
        post: {
          summary: 'Enviar un evento webhook.prueba al webhook del proyecto',
          responses: { '200': { description: '{ entregado: boolean, url?: string, error?: string }' } },
        },
      },
    },
  };
}
