import { PrismaClient } from '@prisma/client';

// ============================================================================
// CLIENTE PRISMA COMPARTIDO
// El aislamiento entre empresas se aplica en cada consulta (filtro por tenantId
// derivado de la clave de API), no mediante un contexto implícito.
// ============================================================================

export const prismaBase = new PrismaClient();
