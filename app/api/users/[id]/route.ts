
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission, canAccessCompany, getCompanyFilter, getCompanyIdForCreate } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { userSchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// GET /api/users/[id] - Obter usuário
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const userId = params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone: true,
        role: true,
        active: true,
        company_id: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se pode acessar o usuário (mesma empresa ou próprio usuário)
    if (!canAccessCompany(session.user.company_id, user.company_id) && session.user.id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para acessar este usuário' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('User GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Atualizar usuário
// PUT /api/users/[id] - Atualizar usuário
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const userId = params.id;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar permissões
    const isSameUser = session.user.id === userId;
    const canManageUsers = hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST']);
    const sameCompany = canAccessCompany(session.user.company_id, existingUser.company_id);

    if (!isSameUser && (!canManageUsers || !sameCompany)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = userSchema.parse(body);

    // Se não é admin/MASTER_DIST, não pode alterar role
    if (!canManageUsers && validatedData.role !== existingUser.role) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para alterar função' },
        { status: 403 }
      );
    }

    // Verificar se email já está em uso por outro usuário
    if (validatedData.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: validatedData.email }
      });

      if (emailExists && emailExists.id !== userId) {
        return NextResponse.json(
          { success: false, error: 'Email já está em uso' },
          { status: 400 }
        );
      }
    }

    const updateData: any = {
      email: validatedData.email,
      first_name: validatedData.firstName,
      last_name: validatedData.lastName,
      phone: validatedData.phone,
      role: validatedData.role
    };

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone: true,
        role: true,
        active: true,
        company_id: true, // ✅ Adicionar para consistência
        created_at: true,
        updated_at: true
      }
    });

    // Log de auditoria (apenas para usuários com empresa)
    if (existingUser.company_id) {
      await createAuditLog({
        company_id: existingUser.company_id,
        user_id: session.user.id,
        entity_type: 'User',
        entity_id: userId,
        action: 'UPDATE',
        old_values: {
          email: existingUser.email,
          role: existingUser.role,
          first_name: existingUser.first_name,
          last_name: existingUser.last_name
        },
        new_values: {
          email: validatedData.email,
          role: validatedData.role,
          first_name: validatedData.firstName,
          last_name: validatedData.lastName
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Usuário atualizado com sucesso!',
      data: updatedUser
    });

  } catch (error) {
    console.error('User PUT error:', error);
    
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

// DELETE /api/users/[id] - Desativar usuário
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
    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST'])) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão' },
        { status: 403 }
      );
    }

    const userId = params.id;

    // Não pode desativar a si mesmo
    if (session.user.id === userId) {
      return NextResponse.json(
        { success: false, error: 'Não é possível desativar sua própria conta' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se é da mesma empresa
    if (!canAccessCompany(session.user.company_id, existingUser.company_id)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para acessar este usuário' },
        { status: 403 }
      );
    }

    // Desativar ao invés de deletar (soft delete)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { active: false },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        active: true
      }
    });

    // Log de auditoria (apenas para usuários com empresa)
    if (existingUser.company_id) {
      await createAuditLog({
        company_id: existingUser.company_id,
        user_id: session.user.id,
        entity_type: 'User',
        entity_id: userId,
        action: 'DELETE',
        old_values: { active: true },
        new_values: { active: false }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Usuário desativado com sucesso!',
      data: updatedUser
    });

  } catch (error) {
    console.error('User DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
