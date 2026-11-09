import { DtePdfService } from '../../../services/dte-pdf.service';
import { ApiError } from '../../norma/errores';
import { definirModulo } from '../../norma/modulo';
import { error, json, paramId, ref } from '../../norma/openapi';

export const moduloDocumentos = definirModulo({
  id: 'documentos',
  nombre: 'Documentos tributarios',
  descripcion:
    'Emisión idempotente de facturas, boletas y notas (33, 34, 39, 41, 56, 61), su estado ante el SII, PDF y XML.',
  version: '1.0.0',
  prefijo: '/documentos',
  permisos: {
    'documentos:emitir': 'Emitir documentos tributarios a nombre de la empresa de la clave.',
    'documentos:leer': 'Listar documentos y descargar su estado, PDF y XML.',
  },
  openapi: {
    paths: {
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
            '202': {
              description:
                'Emitido y enviado de inmediato al SII (ENVIADO con trackId). Si el SII no responde en 10 s o falla, FIRMADO y se reintenta automáticamente.',
              content: json(ref('Documento')),
            },
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
          parameters: [paramId],
          responses: { '200': { description: 'OK', content: json(ref('Documento')) }, '404': error('No encontrado') },
        },
      },
      '/v1/documentos/{id}/pdf': {
        get: {
          summary: 'Representación impresa (PDF con timbre PDF417)',
          parameters: [paramId],
          responses: { '200': { description: 'application/pdf' }, '404': error('No encontrado') },
        },
      },
      '/v1/documentos/{id}/xml': {
        get: {
          summary: 'XML del DTE firmado (ISO-8859-1)',
          parameters: [paramId],
          responses: { '200': { description: 'application/xml' }, '404': error('No encontrado') },
        },
      },
    },
    schemas: {
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
          montoConfirmado: {
            type: 'integer',
            minimum: 1,
            maximum: 2147483647,
            description: 'Total CLP confirmado por el backend de pagos. Si difiere del cálculo, no se consume folio.',
          },
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
    },
  },
  registrar(app, { documentos }) {
    app.post('', { config: { scope: 'documentos:emitir' } }, async (request, reply) => {
      const idempotencyKey = request.headers['idempotency-key'];
      const { documento, idempotente, advertencias } = await documentos.emitir(
        request.apiClient!,
        typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
        request.body
      );
      return reply.code(idempotente ? 200 : 202).send({
        ...documentos.respuesta(documento),
        idempotente,
        ...(advertencias.length > 0 ? { advertencias } : {}),
      });
    });

    app.get('', { config: { scope: 'documentos:leer' } }, async (request) =>
      documentos.listar(request.apiClient!, request.query)
    );

    app.get('/:id', { config: { scope: 'documentos:leer' } }, async (request) => {
      const { id } = request.params as { id: string };
      const doc = await documentos.obtener(request.apiClient!, id);
      if (!doc) throw new ApiError(404, 'Documento no encontrado');
      return documentos.respuesta(doc);
    });

    app.get('/:id/pdf', { config: { scope: 'documentos:leer' } }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const doc = await documentos.obtener(request.apiClient!, id);
      if (!doc) throw new ApiError(404, 'Documento no encontrado');
      const pdf = await DtePdfService.generar(doc);
      return reply
        .type('application/pdf')
        .header('Content-Disposition', `inline; filename="DTE_${doc.tipoDte}_${doc.folio}.pdf"`)
        .send(pdf);
    });

    app.get('/:id/xml', { config: { scope: 'documentos:leer' } }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const doc = await documentos.obtener(request.apiClient!, id);
      if (!doc?.dteXmlFirmado) throw new ApiError(404, 'Documento no encontrado');
      // El DTE se firmó asumiendo el namespace del SII: el XML suelto debe declararlo para verificar
      const dte = doc.dteXmlFirmado.replace(/^<DTE version="1.0">/, '<DTE xmlns="http://www.sii.cl/SiiDte" version="1.0">');
      const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>\n${dte}`;
      return reply
        .type('application/xml; charset=ISO-8859-1')
        .header('Content-Disposition', `attachment; filename="DTE_${doc.tipoDte}_${doc.folio}.xml"`)
        .send(Buffer.from(xml, 'latin1'));
    });
  },
});
