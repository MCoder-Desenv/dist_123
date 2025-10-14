
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission, canAccessCompany, getCompanyFilter, getCompanyIdForCreate } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { financialEntrySchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/financial/[id] - Obter entrada financeira
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const entryId = params.id;

    const entry = await prisma.financialEntry.findUnique({
      where: { id: entryId },
      include: {
        order: {
          select: {
            id: true,
            customer_name: true,
            status: true,
            total_amount: true
          }
        }
      }
    });

    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Entrada financeira não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se pode acessar a entrada (mesma empresa)
    if (!canAccessCompany(session.user.company_id, entry.company_id)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para acessar esta entrada' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: entry
    });

  } catch (error) {
    console.error('Financial entry GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/financial/[id] - Atualizar entrada financeira
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

    const entryId = params.id;

    const existingEntry = await prisma.financialEntry.findUnique({
      where: { id: entryId }
    });

    if (!existingEntry) {
      return NextResponse.json(
        { success: false, error: 'Entrada financeira não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se pode acessar a entrada (mesma empresa)
    if (!canAccessCompany(session.user.company_id, existingEntry.company_id)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para acessar esta entrada' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = financialEntrySchema.parse(body);

    const updatedEntry = await prisma.financialEntry.update({
      where: { id: entryId },
      data: validatedData
    });

    // Log de auditoria
    await createAuditLog({
      company_id: updatedEntry.company_id,
      user_id: session.user.id,
      entity_type: 'FinancialEntry',
      entity_id: entryId,
      action: 'UPDATE',
      old_values: existingEntry,
      new_values: validatedData
    });

    return NextResponse.json({
      success: true,
      message: 'Entrada financeira atualizada com sucesso!',
      data: updatedEntry
    });

  } catch (error) {
    console.error('Financial entry PUT error:', error);
    
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

// DELETE /api/financial/[id] - Deletar entrada financeira
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar permissão
    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'FINANCEIRO'])) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão' },
        { status: 403 }
      );
    }

    const entryId = params.id;

    const existingEntry = await prisma.financialEntry.findUnique({
      where: { id: entryId }
    });

    if (!existingEntry) {
      return NextResponse.json(
        { success: false, error: 'Entrada financeira não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se pode acessar a entrada (mesma empresa)
    if (!canAccessCompany(session.user.company_id, existingEntry.company_id)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para acessar esta entrada' },
        { status: 403 }
      );
    }

    // Não permitir deletar entradas vinculadas a pedidos
    if (existingEntry.order_id) {
      return NextResponse.json(
        { success: false, error: 'Não é possível deletar entradas vinculadas a pedidos' },
        { status: 400 }
      );
    }

    await prisma.financialEntry.delete({
      where: { id: entryId }
    });

    // Log de auditoria
    await createAuditLog({
      company_id: session.user.company_id || '',
      user_id: session.user.id,
      entity_type: 'FinancialEntry',
      entity_id: entryId,
      action: 'DELETE',
      old_values: existingEntry,
      new_values: {}
    });

    return NextResponse.json({
      success: true,
      message: 'Entrada financeira deletada com sucesso!'
    });

  } catch (error) {
    console.error('Financial entry DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
