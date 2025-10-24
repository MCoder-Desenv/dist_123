// app/api/users/[id]/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'MASTER_DIST') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas MASTER_DIST pode redefinir senhas.' },
        { status: 403 }
      );
    }

    const { newPassword } = await req.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: params.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida com sucesso',
    });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return NextResponse.json(
      { error: 'Erro ao redefinir senha' },
      { status: 500 }
    );
  }
}