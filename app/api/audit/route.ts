
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission, getCompanyFilter, getCompanyIdForCreate } from '@/lib/auth';
import { getAuditLogs } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/audit - Listar logs de auditoria da empresa
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar permissão - apenas admin e MASTER_DIST podem ver logs
    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST'])) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const entityType = searchParams.get('entity_type') || '';
    const entityId = searchParams.get('entity_id') || '';

    const options: any = { page, limit };
    if (entityType) options.entityType = entityType;
    if (entityId) options.entityId = entityId;

    const result = await getAuditLogs(session.user.company_id || undefined, options);

    return NextResponse.json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Audit logs GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
