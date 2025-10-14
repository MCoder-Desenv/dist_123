
import { prisma } from './prisma';

export interface AuditLogData {
  company_id: string; // Sempre obrigatório - para ADMINISTRADOR, usar o ID da empresa afetada
  user_id?: string;
  entity_type: string;
  entity_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
}

export async function createAuditLog(data: AuditLogData) {
  try {
    await prisma.auditLog.create({
      data: {
        ...data,
        old_values: data.old_values || {},
        new_values: data.new_values || {}
      }
    });
  } catch (error) {
    console.error('Erro ao criar log de auditoria:', error);
  }
}

export async function getAuditLogs(
  companyId?: string,
  options: {
    page?: number;
    limit?: number;
    entityType?: string;
    entityId?: string;
  } = {}
) {
  const { page = 1, limit = 50, entityType, entityId } = options;
  const skip = (page - 1) * limit;

  const where: any = {};

  // Se companyId foi fornecido, filtrar por ele (usuários normais)
  // Se não foi fornecido, ADMINISTRADOR pode ver tudo
  if (companyId) {
    where.company_id = companyId;
  }

  if (entityType) {
    where.entity_type = entityType;
  }

  if (entityId) {
    where.entity_id = entityId;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        created_at: 'desc'
      },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    }),
    prisma.auditLog.count({ where })
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
