import { definirModulo } from '../../norma/modulo';
import { error } from '../../norma/openapi';

export const moduloEmpresa = definirModulo({
  id: 'empresa',
  nombre: 'Empresa',
  descripcion: 'Empresa emisora de la clave: certificado vigente, folios disponibles y folios por anular.',
  version: '1.0.0',
  prefijo: '/empresa',
  permisos: {
    'empresa:leer': 'Ver la empresa, su certificado y sus folios; probar el webhook.',
  },
  openapi: {
    paths: {
      '/v1/empresa': {
        get: {
          summary: 'Empresa de la clave, certificado vigente, folios disponibles y folios por anular ante el SII',
          responses: { '200': { description: 'OK' }, '401': error('Clave inválida') },
        },
      },
    },
  },
  registrar(app, ctx) {
    app.get('', { config: { scope: 'empresa:leer' } }, async (request) => ctx.documentos.empresa(request.apiClient!));
  },
});
