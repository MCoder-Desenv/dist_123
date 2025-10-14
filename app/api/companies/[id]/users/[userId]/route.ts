// app/api/companies/[id]/users/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerAuthSession, hasPermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { userSchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// PUT /api/companies/[id]/users/[userId] - Atualizar usuário
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST'])) {
      return NextResponse.json({ success: false, error: 'Sem permissão' }, { status: 403 });
    }

    const { id: companyId, userId } = params;

    // Se não for ADMINISTRADOR, só pode mexer em usuários da própria company
    if (session.user.role !== 'ADMINISTRADOR' && session.user.company_id !== companyId) {
      return NextResponse.json({ success: false, error: 'Sem permissão para acessar esta empresa' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 });
    }
    if (user.company_id !== companyId) {
      return NextResponse.json({ success: false, error: 'Usuário não pertence a esta empresa' }, { status: 403 });
    }

    const body = await request.json();

    // Normalizar entrada: aceita tanto camelCase quanto snake_case
    const normalized = {
      ...body,
      firstName: (body.firstName ?? body.first_name) as string | undefined,
      lastName: (body.lastName ?? body.last_name) as string | undefined
    };

    // permitir partial update, incluir `active` como opcional e impedir alteração de email
    const validatedData = userSchema
      .partial()
      .omit({ email: true })
      .extend({ active: z.boolean().optional() })
      .parse(normalized);

    // remover senha vazia (caso front envie "")
    if (typeof validatedData.password === 'string' && !validatedData.password.trim()) {
      delete (validatedData as any).password;
    }

    // se não há campos para atualizar
    if (Object.keys(validatedData).length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    // proteção para promoção a ADMINISTRADOR
    if (validatedData.role === 'ADMINISTRADOR' && session.user.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ success: false, error: 'Sem permissão para alterar para administrador' }, { status: 403 });
    }

    // Construir payload para o Prisma (converter camelCase -> snake_case)
    const prismaPayload: any = {};
    if (validatedData.firstName !== undefined) prismaPayload.first_name = validatedData.firstName;
    if (validatedData.lastName !== undefined) prismaPayload.last_name = validatedData.lastName;
    if (validatedData.phone !== undefined) prismaPayload.phone = validatedData.phone;
    if (validatedData.role !== undefined) prismaPayload.role = validatedData.role;
    if (validatedData.active !== undefined) prismaPayload.active = validatedData.active;

    // tratar senha separadamente (hash)
    if (validatedData.password) {
      prismaPayload.password = await bcrypt.hash(validatedData.password, 12);
    }

    prismaPayload.updated_at = new Date();

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: prismaPayload,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone: true,
        role: true,
        active: true,
        created_at: true
      }
    });

    // criar logs com valores em camelCase para facilitar leitura nos registros (opcional)
    await createAuditLog({
      company_id: companyId,
      user_id: session.user.id,
      entity_type: 'User',
      entity_id: userId,
      action: 'UPDATE',
      old_values: {
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        active: user.active
      },
      new_values: {
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phone: updatedUser.phone,
        role: updatedUser.role,
        active: updatedUser.active
      }
    });

    // Responder ao cliente em camelCase
    const responseData = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.first_name,
      lastName: updatedUser.last_name,
      phone: updatedUser.phone,
      role: updatedUser.role,
      active: updatedUser.active,
      createdAt: updatedUser.created_at
    };

    return NextResponse.json({ success: true, message: 'Usuário atualizado com sucesso!', data: responseData }, { status: 200 });

  } catch (error: any) {
    console.error('Company User PUT error:', error);
    if (error?.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Dados inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE /api/companies/[id]/users/[userId] - Excluir usuário
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST'])) {
      return NextResponse.json({ success: false, error: 'Sem permissão' }, { status: 403 });
    }

    const { id: companyId, userId } = params;

    // Se não for ADMINISTRADOR, só pode mexer em usuários da própria company
    if (session.user.role !== 'ADMINISTRADOR' && session.user.company_id !== companyId) {
      return NextResponse.json({ success: false, error: 'Sem permissão para acessar esta empresa' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 });
    }
    if (user.company_id !== companyId) {
      return NextResponse.json({ success: false, error: 'Usuário não pertence a esta empresa' }, { status: 403 });
    }

    // impedir auto-deleção
    if (user.id === session.user.id) {
      return NextResponse.json({ success: false, error: 'Não é possível excluir seu próprio usuário' }, { status: 400 });
    }

    // proteger ADMINISTRADOR contra remoção por não-admins
    if (user.role === 'ADMINISTRADOR' && session.user.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ success: false, error: 'Sem permissão para excluir administrador' }, { status: 403 });
    }

    // Aqui você pode optar por soft-delete em vez de remover; mantive delete conforme seu código original.
    await prisma.user.delete({ where: { id: userId } });

    await createAuditLog({
      company_id: companyId,
      user_id: session.user.id,
      entity_type: 'User',
      entity_id: userId,
      action: 'DELETE',
      old_values: {
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });

    return NextResponse.json({ success: true, message: 'Usuário excluído com sucesso!' }, { status: 200 });

  } catch (error) {
    console.error('Company User DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}