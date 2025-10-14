
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission, getCompanyFilter, getCompanyIdForCreate } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { financialEntrySchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/financial - Listar entradas financeiras da empresa
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar permissão
    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST', 'FINANCEIRO'])) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type') || '';
    const status = searchParams.get('status') || '';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const skip = (page - 1) * limit;

    const companyFilter = getCompanyFilter(session);
    const where: any = {
      ...companyFilter
    };
    
    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.created_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [entries, total, summary] = await Promise.all([
      prisma.financialEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              customer_name: true,
              status: true
            }
          }
        }
      }),
      prisma.financialEntry.count({ where }),
      // Resumo financeiro
      prisma.financialEntry.groupBy({
        by: ['type', 'status'],
        where: {
      ...getCompanyFilter(session),
          created_at: startDate && endDate ? {
            gte: new Date(startDate),
            lte: new Date(endDate)
          } : undefined
        },
        _sum: {
          amount: true
        }
      })
    ]);

    // Calcular resumo
    let totalReceitas = 0;
    let totalDespesas = 0;
    let receitasPendentes = 0;
    let receitasPagas = 0;
    let despesasPendentes = 0;
    let despesasPagas = 0;

    summary.forEach(item => {
      const amount = Number(item._sum.amount || 0);
      if (item.type === 'RECEITA') {
        totalReceitas += amount;
        if (item.status === 'PENDENTE') receitasPendentes += amount;
        if (item.status === 'PAGO') receitasPagas += amount;
      } else {
        totalDespesas += amount;
        if (item.status === 'PENDENTE') despesasPendentes += amount;
        if (item.status === 'PAGO') despesasPagas += amount;
      }
    });

    const saldoTotal = totalReceitas - totalDespesas;

    return NextResponse.json({
      success: true,
      data: entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        total_receitas: totalReceitas,
        total_despesas: totalDespesas,
        saldo_total: saldoTotal,
        receitas_pendentes: receitasPendentes,
        receitas_pagas: receitasPagas,
        despesas_pendentes: despesasPendentes,
        despesas_pagas: despesasPagas
      }
    });

  } catch (error) {
    console.error('Financial entries GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/financial - Criar nova entrada financeira
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar permissão
    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST', 'FINANCEIRO'])) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = financialEntrySchema.parse(body);
    
    const companyId = getCompanyIdForCreate(session);

    const entry = await prisma.financialEntry.create({
      data: {
        company_id: companyId,
        type: validatedData.type,
        amount: validatedData.amount,
        description: validatedData.description,
        category: validatedData.category,
        payment_method: validatedData.payment_method,
        due_date: validatedData.due_date,
        paid_date: validatedData.paid_date,
        status: validatedData.status
      }
    });

    // Log de auditoria
    await createAuditLog({
      company_id: companyId,
      user_id: session.user.id,
      entity_type: 'FinancialEntry',
      entity_id: entry.id,
      action: 'CREATE',
      new_values: validatedData
    });

    return NextResponse.json({
      success: true,
      message: 'Entrada financeira criada com sucesso!',
      data: entry
    });

  } catch (error) {
    console.error('Financial entries POST error:', error);
    
    if (error instanceof Error && 'code' in error) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
