import type { FastifyInstance } from 'fastify';

// Clave de los usuarios de demostración durante las pruebas
export const CLAVE_DEMO = 'clave-demo-de-pruebas';
process.env.FELINE_PANEL_CLAVE_DEMO = CLAVE_DEMO;

export const ADMIN = 'angel.becer.p@gmail.com'; // ADMIN, empresas 1 y 2
export const CONTADORA = 'patricia.contabilidad@feline.cl'; // ACCOUNTANT, empresa 1
export const VENTAS = 'matias.ventas@andina.cl'; // BILLING, empresa 2

/** Inicia sesión y devuelve la cabecera Cookie para las siguientes peticiones. */
export async function iniciarSesion(app: FastifyInstance, email: string, clave = CLAVE_DEMO): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/v1/panel/login', payload: { email, clave } });
  if (res.statusCode !== 200) throw new Error('No se pudo iniciar sesión: ' + res.body);
  const cookie = String(res.headers['set-cookie']).split(';')[0];
  return cookie;
}
