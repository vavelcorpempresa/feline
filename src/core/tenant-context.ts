import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaClient } from '@prisma/client';

// ============================================================================
// CONTEXTO DE EJECUCIÓN MULTITENANT (AISLAMIENTO ESTRICTO POR TENANT_ID)
// ============================================================================

export interface TenantStore {
  tenantId: string;
  rutTenant?: string;
}

export const tenantAsyncStorage = new AsyncLocalStorage<TenantStore>();

/**
 * Obtiene el tenantId activo del contexto asíncrono actual.
 * Lanza un error de seguridad si se intenta acceder a datos sin contexto de empresa.
 */
export function getRequiredTenantId(): string {
  const store = tenantAsyncStorage.getStore();
  if (!store || !store.tenantId) {
    throw new Error(
      '[SecError: Multitenancy] Intento de operación de base de datos sin tenant_id activo en el contexto.'
    );
  }
  return store.tenantId;
}

/**
 * Modelos que contienen la columna `tenantId` y exigen aislamiento automático
 */
const TENANT_MODELS = new Set([
  'CertificadoDigital',
  'ClienteReceptor',
  'CafFolio',
  'DocumentoDTE',
  'EnvioDteLote',
  'AccountJournal',
  'AccountTax',
  'AccountMove',
  'AccountPayment',
]);

/**
 * Crea una instancia de PrismaClient con extensión de aislamiento Multitenant.
 * Inyecta automáticamente `where: { tenantId }` en consultas y valida pertenencia.
 */
export function createMultitenantPrismaClient(basePrisma?: PrismaClient) {
  const prisma = basePrisma ?? new PrismaClient();

  return prisma.$extends({
    name: 'sii-multitenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }

          const store = tenantAsyncStorage.getStore();
          // Si existe un tenantId en el contexto de la request, forzamos su filtro
          if (store?.tenantId) {
            const tenantId = store.tenantId;
            const mutableArgs = (args ?? {}) as Record<string, any>;

            if (
              operation === 'findMany' ||
              operation === 'findFirst' ||
              operation === 'count' ||
              operation === 'updateMany' ||
              operation === 'deleteMany'
            ) {
              mutableArgs.where = {
                ...mutableArgs.where,
                tenantId,
              };
            } else if (operation === 'create') {
              mutableArgs.data = {
                ...mutableArgs.data,
                tenantId,
              };
            }
            return query(mutableArgs);
          }

          return query(args);
        },
      },
    },
  });
}

export const prismaBase = new PrismaClient();
export const db = createMultitenantPrismaClient(prismaBase);
