import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission, canAccessCompany, getCompanyFilter, getCompanyIdForCreate } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { userSchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// GET /api/users - Listar usuários da empresa
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
    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST', 'SUB_MASTER'])) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const roleFilter = searchParams.get('role') || '';
    const skip = (page - 1) * limit;

    const where: any = {
      ...getCompanyFilter(session)
    };
    
    // Aplicar filtro por role se especificado
    if (roleFilter) {
      where.role = roleFilter;
    }

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone: true,
        role: true,
        active: true,
        created_at: true,
      }
    });

    const total = await prisma.user.count({ where });

    const mapped = users.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      phone: u.phone,
      role: u.role,
      active: u.active,
      created_at: u.created_at.toISOString(),
    }));

    return NextResponse.json({ 
      success: true, 
      data: mapped,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/users - Criar novo usuário
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar permissão geral
    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST', 'SUB_MASTER'])) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = userSchema.parse(body);

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email já está em uso' },
        { status: 400 }
      );
    }

    // Hash da senha
    if (!validatedData.password) {
      return NextResponse.json(
        { success: false, error: 'Senha é obrigatória' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Verificar permissão para criar administrador
    if (validatedData.role === 'ADMINISTRADOR' && 
        !hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST'])) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para criar administrador' },
        { status: 403 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        first_name: validatedData.firstName,
        last_name: validatedData.lastName,
        phone: validatedData.phone,
        role: validatedData.role,
        ...getCompanyFilter(session),
        active: true
      },
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

    // Log de auditoria
    await createAuditLog({
      company_id: session.user.company_id || '',
      user_id: session.user.id,
      entity_type: 'User',
      entity_id: user.id,
      action: 'CREATE',
      new_values: {
        email: user.email,
        role: user.role,
        active: user.active
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Usuário criado com sucesso!',
      data: user
    });

  } catch (error) {
    console.error('Users POST error:', error);
    
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