
import { NextResponse } from 'next/server';
import { getServerAuthSession, getCompanyFilter, getCompanyIdForCreate } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

// PUT - Atualizar cliente
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar permissão
    if (!hasPermission(session.user.role as UserRole, 'customers', 'update')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const { name, email, phone, password } = await request.json();

    // Verificar se o cliente pertence à empresa do usuário
    const customer = await prisma.customer.findFirst({
      where: {
        id: params.id,
        ...getCompanyFilter(session),
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Verificar se o novo email já está em uso por outro cliente
    if (email && email.toLowerCase() !== customer.email) {
      const companyFilter = getCompanyFilter(session);
      const companyId = companyFilter.company_id || customer.company_id;
      
      const existingCustomer = await prisma.customer.findUnique({
        where: {
          company_id_email: {
            company_id: companyId,
            email: email.toLowerCase(),
          },
        },
      });

      if (existingCustomer) {
        return NextResponse.json(
          { error: 'Já existe um cliente com este e-mail' },
          { status: 400 }
        );
      }
    }

    const updateData: any = {
      name,
      email: email?.toLowerCase(),
      phone,
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        created_at: true,
      },
    });

    return NextResponse.json({ data: updatedCustomer });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar cliente' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir cliente
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar permissão
    if (!hasPermission(session.user.role as UserRole, 'customers', 'delete')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Verificar se o cliente pertence à empresa do usuário
    const customer = await prisma.customer.findFirst({
      where: {
        id: params.id,
        ...getCompanyFilter(session),
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Verificar se o cliente tem pedidos
    const orderCount = await prisma.order.count({
      where: { customer_id: params.id },
    });

    if (orderCount > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir cliente com pedidos' },
        { status: 400 }
      );
    }

    await prisma.customer.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Cliente excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir cliente' },
      { status: 500 }
    );
  }
}
