import { NextResponse } from 'next/server';
import { getServerAuthSession, getCompanyFilter } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

// POST - Redefinir senha do cliente
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar permissão - apenas MASTER_DIST pode redefinir senhas
    if (!hasPermission(session.user.role as UserRole, 'customers', 'update')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const { newPassword } = await request.json();

    if (!newPassword) {
      return NextResponse.json(
        { error: 'Nova senha é obrigatória' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      );
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

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await prisma.customer.update({
      where: { id: params.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ 
      message: 'Senha redefinida com sucesso',
      data: { id: params.id }
    });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return NextResponse.json(
      { error: 'Erro ao redefinir senha' },
      { status: 500 }
    );
  }
}