// app/api/companies/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { companySchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/companies/[id] - Obter empresa
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    // Apenas ADMINISTRADOR pode ver dados de empresas
    if (session.user.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ success: false, error: 'Acesso negado. Apenas administradores podem visualizar empresas.' }, { status: 403 });
    }

    const companyId = params.id;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: { users: true, products: true, orders: true }
        }
      }
    });

    if (!company) {
      return NextResponse.json({ success: false, error: 'Empresa não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: company }, { status: 200 });
  } catch (error) {
    console.error('Company GET error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT /api/companies/[id] - Atualizar empresa
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    if (session.user.role !== 'ADMINISTRADOR') return NextResponse.json({ success: false, error: 'Acesso negado. Apenas administradores podem editar empresas.' }, { status: 403 });

    const companyId = params.id;
    const existingCompany = await prisma.company.findUnique({ where: { id: companyId } });
    if (!existingCompany) return NextResponse.json({ success: false, error: 'Empresa não encontrada' }, { status: 404 });

    const body = await request.json();
    const validatedData = companySchema.parse(body);

    // Verificar slug em uso por outra empresa
    if (validatedData.slug !== existingCompany.slug) {
      const slugInUse = await prisma.company.findUnique({ where: { slug: validatedData.slug } });
      if (slugInUse && slugInUse.id !== companyId) {
        return NextResponse.json({ success: false, error: 'Slug já está em uso' }, { status: 400 });
      }
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: validatedData
    });

    await createAuditLog({
      company_id: companyId,
      user_id: session.user.id,
      entity_type: 'Company',
      entity_id: companyId,
      action: 'UPDATE',
      old_values: existingCompany,
      new_values: validatedData
    });

    return NextResponse.json({ success: true, message: 'Empresa atualizada com sucesso!', data: updatedCompany }, { status: 200 });
  } catch (error: any) {
    console.error('Company PUT error:', error);
    if (error?.name === 'ZodError') return NextResponse.json({ success: false, error: 'Dados inválidos', details: error.errors }, { status: 400 });
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE /api/companies/[id] - Desativar (soft-delete)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user || session.user.role !== 'ADMINISTRADOR') return NextResponse.json({ success: false, error: 'Sem permissão' }, { status: 403 });

    const companyId = params.id;
    const existingCompany = await prisma.company.findUnique({ where: { id: companyId } });
    if (!existingCompany) return NextResponse.json({ success: false, error: 'Empresa não encontrada' }, { status: 404 });

    const updatedCompany = await prisma.company.update({ where: { id: companyId }, data: { active: false } });

    await createAuditLog({
      company_id: companyId,
      user_id: session.user.id,
      entity_type: 'Company',
      entity_id: companyId,
      action: 'DELETE',
      old_values: { active: true },
      new_values: { active: false }
    });

    return NextResponse.json({ success: true, message: 'Empresa desativada com sucesso!', data: updatedCompany }, { status: 200 });
  } catch (error) {
    console.error('Company DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}