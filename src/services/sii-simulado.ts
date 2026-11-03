// ============================================================================
// SII SIMULADO (SOLO DESARROLLO / PRUEBAS DE INTEGRACIÓN)
// Implementa un `fetch` que responde como los Web Services del SII (SOAP DTE y REST Boletas),
// aceptando todo envío. Permite probar el ciclo completo con integraciones externas sin
// certificado ni CAF reales. Nunca debe usarse en producción.
// ============================================================================

const soapRespuesta = (tag: string, cuerpo: string) =>
  `<soapenv:Envelope><soapenv:Body><${tag}>` +
  `&lt;SII:RESPUESTA&gt;&lt;SII:RESP_HDR&gt;${cuerpo}&lt;/SII:RESP_HDR&gt;&lt;/SII:RESPUESTA&gt;` +
  `</${tag}></soapenv:Body></soapenv:Envelope>`;

export function crearFetchSiiSimulado(): typeof fetch {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El SII simulado no puede usarse en producción.');
  }

  let secuencia = 0;
  const nuevoTrackId = () => String(Date.now()).slice(-8) + String(++secuencia).padStart(2, '0');

  return async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    // ---- SOAP DTE ----
    if (url.includes('CrSeed.jws')) {
      return new Response(
        soapRespuesta('getSeedReturn', '&lt;ESTADO&gt;00&lt;/ESTADO&gt;&lt;SEMILLA&gt;000000000001&lt;/SEMILLA&gt;')
      );
    }
    if (url.includes('GetTokenFromSeed.jws')) {
      return new Response(
        soapRespuesta('getTokenReturn', `&lt;ESTADO&gt;00&lt;/ESTADO&gt;&lt;TOKEN&gt;SIMULADO${Date.now()}&lt;/TOKEN&gt;`)
      );
    }
    if (url.includes('DTEUpload')) {
      return new Response(
        `<?xml version="1.0" encoding="ISO-8859-1"?><RECEPCIONDTE><STATUS>0</STATUS>` +
          `<TRACKID>${nuevoTrackId()}</TRACKID><TIMESTAMP>${new Date().toISOString()}</TIMESTAMP></RECEPCIONDTE>`
      );
    }
    if (url.includes('QueryEstUp.jws')) {
      return new Response(
        soapRespuesta(
          'getEstUpReturn',
          '&lt;ESTADO&gt;EPR&lt;/ESTADO&gt;&lt;GLOSA&gt;Envio Procesado (SIMULADO)&lt;/GLOSA&gt;' +
            '&lt;ACEPTADOS&gt;1&lt;/ACEPTADOS&gt;&lt;RECHAZADOS&gt;0&lt;/RECHAZADOS&gt;&lt;REPAROS&gt;0&lt;/REPAROS&gt;'
        )
      );
    }

    // ---- REST Boletas ----
    if (url.endsWith('boleta.electronica.semilla')) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><SII:RESPUESTA xmlns:SII="http://www.sii.cl/XMLSchema">' +
          '<SII:RESP_BODY><SEMILLA>000000000001</SEMILLA></SII:RESP_BODY><SII:RESP_HDR><ESTADO>00</ESTADO></SII:RESP_HDR></SII:RESPUESTA>'
      );
    }
    if (url.endsWith('boleta.electronica.token')) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><SII:RESPUESTA xmlns:SII="http://www.sii.cl/XMLSchema">' +
          `<SII:RESP_BODY><TOKEN>SIMULADO${Date.now()}</TOKEN></SII:RESP_BODY><SII:RESP_HDR><ESTADO>00</ESTADO></SII:RESP_HDR></SII:RESPUESTA>`
      );
    }
    if (url.endsWith('boleta.electronica.envio') && method === 'POST') {
      return Response.json({ trackid: Number(nuevoTrackId()), estado: 'REC', fecha_recepcion: new Date().toISOString() });
    }
    if (url.includes('boleta.electronica.envio/') && method === 'GET') {
      return Response.json({
        estado: 'EPR',
        estadistica: [{ tipo: 39, informados: 1, aceptados: 1, rechazados: 0, reparos: 0 }],
      });
    }

    return new Response(`SII simulado: endpoint no soportado (${method} ${url})`, { status: 404 });
  };
}
