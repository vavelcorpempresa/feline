import crypto from 'node:crypto';
import fs from 'node:fs';
import forge from 'node-forge';
import { PrismaClient } from '@prisma/client';
import { CryptoVaultService } from '../core/crypto-vault';
import { CafTedService } from '../services/caf-ted.service';
import { XmlDsigSignerService } from '../services/xmldsig-signer.service';
import { FelineLiveSandboxStore } from '../services/feline-live-sandbox.service';
import { generarApiKey, SCOPES, Scope } from '../api/v1/documentos.routes';
import { CodigoTipoDTE } from '../types/sii-dte.types';
import { normalizeAndValidateRut } from '../utils/sii-normative.utils';

// ============================================================================
// ADMINISTRACIÓN DE FELINE POR CONSOLA (no se expone por HTTP)
//   npm run admin -- empresa:crear --json empresa.json
//   npm run admin -- certificado:cargar --rut 76192083-9 --pfx firma.pfx --clave "****"
//   npm run admin -- caf:cargar --rut 76192083-9 --xml FoliosSII33.xml
//
// PROYECTOS CONECTADOS (cada uno con su clave, permisos y webhook):
//   npm run admin -- proyecto:conectar --rut 76192083-9 --nombre "FUGAR Marketplace" --webhook-url https://.../webhook [--permisos documentos:emitir,documentos:leer,empresa:leer]
//   npm run admin -- proyecto:listar [--rut 76192083-9]
//   npm run admin -- proyecto:rotar-clave --id <proyecto>
//   npm run admin -- proyecto:webhook --id <proyecto> --url https://.../webhook   (genera secreto nuevo; --url "" lo quita)
//   npm run admin -- proyecto:revocar --id <proyecto>
//   (api-client:crear se mantiene como alias de proyecto:conectar)
//   npm run admin -- dev:empresa-prueba --webhook-url http://localhost:3000/api/v1/billing/webhook   (solo desarrollo)
// ============================================================================

export interface EmpresaInput {
  rut: string;
  razonSocial: string;
  giro: string;
  acteco: number[];
  direccionOrigen: string;
  comunaOrigen: string;
  ciudadOrigen: string;
  fchResol: string; // AAAA-MM-DD
  nroResol: number; // 0 en certificación
  rutEnvia: string;
  environment?: 'CERTIFICACION' | 'PRODUCCION';
}

export class FelineAdmin {
  private readonly vault = new CryptoVaultService();
  private readonly caf: CafTedService;
  private readonly signer: XmlDsigSignerService;

  constructor(private readonly prisma: PrismaClient) {
    this.caf = new CafTedService(prisma, this.vault);
    this.signer = new XmlDsigSignerService(prisma, this.vault);
  }

  public async crearEmpresa(e: EmpresaInput) {
    const rut = normalizeAndValidateRut(e.rut);
    const data = {
      razonSocial: e.razonSocial.substring(0, 100),
      giro: e.giro.substring(0, 80),
      acteco: e.acteco.slice(0, 4),
      direccionOrigen: e.direccionOrigen.substring(0, 70),
      comunaOrigen: e.comunaOrigen.substring(0, 20),
      ciudadOrigen: e.ciudadOrigen.substring(0, 20),
      fchResol: new Date(e.fchResol),
      nroResol: e.nroResol,
      rutEnvia: normalizeAndValidateRut(e.rutEnvia),
      environment: e.environment ?? 'CERTIFICACION',
    };
    return this.prisma.tenant.upsert({ where: { rut }, update: data, create: { rut, ...data } });
  }

  public async tenantPorRut(rut: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { rut: normalizeAndValidateRut(rut) } });
    if (!tenant) throw new Error(`No existe la empresa ${rut}. Créala con empresa:crear.`);
    return tenant;
  }

  public async cargarCertificado(rut: string, pfx: Buffer, clave: string) {
    const tenant = await this.tenantPorRut(rut);
    return this.signer.storeCertificateForTenant(tenant.id, pfx, clave);
  }

  public async cargarCaf(rut: string, xmlAutorizacion: string) {
    const tenant = await this.tenantPorRut(rut);
    const caf = await this.caf.uploadCafForTenant(tenant.id, xmlAutorizacion);
    return { id: caf.id, tipoDte: caf.tipoDte, folioDesde: caf.folioDesde, folioHasta: caf.folioHasta };
  }

  /** Conecta un proyecto a una empresa. La clave en claro se devuelve una sola vez. */
  public async crearApiClient(params: {
    rut: string;
    nombre: string;
    webhookUrl?: string;
    webhookSecret?: string;
    permisos?: string[];
  }) {
    const tenant = await this.tenantPorRut(params.rut);
    const permisos = FelineAdmin.validarPermisos(params.permisos);
    if (params.webhookUrl) FelineAdmin.validarUrl(params.webhookUrl);
    const { clave, prefix, hash } = generarApiKey();
    const webhookSecret = params.webhookUrl
      ? params.webhookSecret || crypto.randomBytes(32).toString('hex')
      : null;
    const client = await this.prisma.apiClient.create({
      data: {
        tenantId: tenant.id,
        nombre: params.nombre.substring(0, 80),
        keyPrefix: prefix,
        keyHash: hash,
        scopes: permisos,
        webhookUrl: params.webhookUrl ?? null,
        webhookSecret,
      },
    });
    return { id: client.id, clave, webhookSecret, permisos };
  }

  public async listarProyectos(rut?: string) {
    const tenantId = rut ? (await this.tenantPorRut(rut)).id : undefined;
    const clientes = await this.prisma.apiClient.findMany({
      where: tenantId ? { tenantId } : {},
      include: { tenant: { select: { rut: true } }, _count: { select: { documentos: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return clientes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      empresa: c.tenant.rut,
      clave: `${c.keyPrefix}…`,
      permisos: c.scopes.join(','),
      webhook: c.webhookUrl ?? '-',
      activo: c.isActive,
      documentos: c._count.documentos,
      ultimoUso: c.lastUsedAt?.toISOString().slice(0, 16).replace('T', ' ') ?? 'nunca',
    }));
  }

  /** Reemplaza la clave del proyecto: la anterior deja de funcionar de inmediato. */
  public async rotarClave(id: string) {
    const { clave, prefix, hash } = generarApiKey();
    await this.prisma.apiClient.update({ where: { id }, data: { keyPrefix: prefix, keyHash: hash, isActive: true } });
    return { clave };
  }

  /** Configura (o quita, con url vacía) el webhook del proyecto, generando un secreto nuevo. */
  public async configurarWebhook(id: string, url: string) {
    if (!url) {
      await this.prisma.apiClient.update({ where: { id }, data: { webhookUrl: null, webhookSecret: null } });
      return { webhookUrl: null, webhookSecret: null };
    }
    FelineAdmin.validarUrl(url);
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    await this.prisma.apiClient.update({ where: { id }, data: { webhookUrl: url, webhookSecret } });
    return { webhookUrl: url, webhookSecret };
  }

  public async revocarProyecto(id: string) {
    const c = await this.prisma.apiClient.update({ where: { id }, data: { isActive: false } });
    return { id: c.id, nombre: c.nombre };
  }

  private static validarPermisos(permisos?: string[]): Scope[] {
    if (!permisos || permisos.length === 0) return [...SCOPES];
    const invalidos = permisos.filter((p) => !(SCOPES as readonly string[]).includes(p));
    if (invalidos.length > 0) {
      throw new Error(`Permisos inválidos: ${invalidos.join(', ')}. Válidos: ${SCOPES.join(', ')}`);
    }
    return permisos as Scope[];
  }

  private static validarUrl(url: string) {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      throw new Error(`URL de webhook inválida: ${url}`);
    }
    const local = ['localhost', '127.0.0.1', '::1'].includes(u.hostname) || u.hostname.endsWith('.test');
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
      throw new Error('El webhook debe usar https (http solo se permite en localhost).');
    }
  }

  /**
   * SOLO DESARROLLO: empresa de prueba con certificado autofirmado y CAF generados localmente
   * (el SII no los acepta: sirven con FELINE_SII_MODO=simulado para probar integraciones).
   */
  public async crearEmpresaPrueba(params: { rut?: string; webhookUrl?: string; webhookSecret?: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('dev:empresa-prueba no está disponible en producción.');
    }
    // Valores por defecto del emisor en FUGAR (lib/services/dte.service.ts)
    const rut = normalizeAndValidateRut(params.rut ?? '76192083-9');
    const tenant = await this.crearEmpresa({
      rut,
      razonSocial: 'EMPRESA DE PRUEBA SPA',
      giro: 'Venta al por menor',
      acteco: [479100],
      direccionOrigen: 'Av. Providencia 1234',
      comunaOrigen: 'Providencia',
      ciudadOrigen: 'Santiago',
      fchResol: '2026-01-01',
      nroResol: 0,
      rutEnvia: '11111111-1',
    });

    const clave = 'prueba1234';
    await this.cargarCertificado(rut, FelineAdmin.generarPfxAutofirmado('FIRMANTE DE PRUEBA', '11111111-1', clave), clave);

    const tipos = [33, 34, 39, 41, 56, 61] as CodigoTipoDTE[];
    for (const tipoDte of tipos) {
      const yaTiene = await this.prisma.cafFolio.findFirst({
        where: { tenantId: tenant.id, tipoDte, activo: true, agotado: false },
      });
      if (yaTiene) continue;
      // Continuar después del último rango (agotado) para no repetir folios
      const ultimo = await this.prisma.cafFolio.aggregate({
        where: { tenantId: tenant.id, tipoDte },
        _max: { folioHasta: true },
      });
      const desde = (ultimo._max.folioHasta ?? 0) + 1;
      const { xmlAutorizacion } = FelineLiveSandboxStore.generateCafXml({
        rutEmisor: rut,
        razonSocial: tenant.razonSocial,
        tipoDte,
        desde,
        hasta: desde + 999,
      });
      await this.cargarCaf(rut, xmlAutorizacion);
    }

    const api = await this.crearApiClient({
      rut,
      nombre: 'FUGAR Marketplace (desarrollo)',
      webhookUrl: params.webhookUrl,
      webhookSecret: params.webhookSecret,
    });
    return { tenantId: tenant.id, rut, ...api };
  }

  public static generarPfxAutofirmado(nombre: string, rutTitular: string, clave: string): Buffer {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date(Date.now() - 86_400_000);
    cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
    const attrs = [
      { name: 'commonName', value: nombre },
      { name: 'countryName', value: 'CL' },
      { name: 'serialNumber', value: rutTitular },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], clave, { algorithm: '3des' });
    return Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary');
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function args(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] ?? '';
  }
  return out;
}

async function main() {
  const [comando, ...resto] = process.argv.slice(2);
  const a = args(resto);
  const prisma = new PrismaClient();
  const admin = new FelineAdmin(prisma);
  const requerido = (k: string) => {
    if (!a[k]) throw new Error(`Falta --${k}`);
    return a[k];
  };

  try {
    switch (comando) {
      case 'empresa:crear': {
        const e = await admin.crearEmpresa(JSON.parse(fs.readFileSync(requerido('json'), 'utf8')));
        console.log(`Empresa ${e.rut} (${e.razonSocial}) lista. id=${e.id}`);
        break;
      }
      case 'certificado:cargar': {
        const c = await admin.cargarCertificado(requerido('rut'), fs.readFileSync(requerido('pfx')), requerido('clave'));
        console.log(`Certificado de ${c.nombreTitular} cargado (vence ${c.validTo.toISOString().slice(0, 10)}).`);
        break;
      }
      case 'caf:cargar': {
        const c = await admin.cargarCaf(requerido('rut'), fs.readFileSync(requerido('xml'), 'latin1'));
        console.log(`CAF tipo ${c.tipoDte} cargado: folios ${c.folioDesde}-${c.folioHasta}.`);
        break;
      }
      case 'proyecto:conectar':
      case 'api-client:crear': {
        const r = await admin.crearApiClient({
          rut: requerido('rut'),
          nombre: requerido('nombre'),
          webhookUrl: a['webhook-url'],
          webhookSecret: a['webhook-secret'],
          permisos: a['permisos'] ? a['permisos'].split(',').map((p) => p.trim()) : undefined,
        });
        console.log(`Proyecto conectado (id ${r.id}, permisos: ${r.permisos.join(', ')}).`);
        console.log('Variables para el .env del proyecto (la clave no se vuelve a mostrar):\n');
        console.log(`FELINE_API_URL=${process.env.FELINE_PUBLIC_URL || 'http://localhost:3004'}`);
        console.log(`FELINE_API_KEY=${r.clave}`);
        if (r.webhookSecret) console.log(`FELINE_WEBHOOK_SECRET=${r.webhookSecret}`);
        break;
      }
      case 'proyecto:listar': {
        console.table(await admin.listarProyectos(a['rut']));
        break;
      }
      case 'proyecto:rotar-clave': {
        const r = await admin.rotarClave(requerido('id'));
        console.log('Clave nueva (la anterior ya no funciona). No se vuelve a mostrar:\n');
        console.log(`FELINE_API_KEY=${r.clave}`);
        break;
      }
      case 'proyecto:webhook': {
        const r = await admin.configurarWebhook(requerido('id'), a['url'] ?? '');
        if (!r.webhookUrl) console.log('Webhook eliminado.');
        else console.log(`Webhook: ${r.webhookUrl}\nFELINE_WEBHOOK_SECRET=${r.webhookSecret}`);
        break;
      }
      case 'proyecto:revocar': {
        const r = await admin.revocarProyecto(requerido('id'));
        console.log(`Proyecto "${r.nombre}" revocado: su clave ya no funciona.`);
        break;
      }
      case 'dev:empresa-prueba': {
        const r = await admin.crearEmpresaPrueba({
          rut: a['rut'],
          webhookUrl: a['webhook-url'],
          webhookSecret: a['webhook-secret'],
        });
        console.log(`Empresa de prueba ${r.rut} lista (certificado autofirmado y CAF locales).`);
        console.log('Variables para el .env de FUGAR (la clave no se vuelve a mostrar):\n');
        console.log(`MOTOR_DTE_API_URL=${process.env.FELINE_PUBLIC_URL || 'http://localhost:3004'}/v1`);
        console.log(`MOTOR_DTE_API_KEY=${r.clave}`);
        if (r.webhookSecret) console.log(`MOTOR_DTE_WEBHOOK_SECRET=${r.webhookSecret}`);
        console.log(`EMISOR_RUT=${r.rut}`);
        break;
      }
      default:
        console.log(
          'Comandos: empresa:crear | certificado:cargar | caf:cargar | dev:empresa-prueba\n' +
            '          proyecto:conectar | proyecto:listar | proyecto:rotar-clave | proyecto:webhook | proyecto:revocar'
        );
        process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
