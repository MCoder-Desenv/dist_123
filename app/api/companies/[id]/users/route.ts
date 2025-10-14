// app/api/companies/[id]/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerAuthSession, hasPermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { userSchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// GET /api/companies/[id]/users - Listar usuários da empresa
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });

    const companyId = params.id;
    if (session.user.role !== 'ADMINISTRADOR' && session.user.company_id !== companyId) {
      return NextResponse.json({ success: false, error: 'Sem permissão para acessar esta empresa' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      where: { company_id: companyId },
      select: { id: true, email: true, first_name: true, last_name: true, phone: true, role: true, active: true, created_at: true },
      orderBy: { created_at: 'desc' }
    });

    return NextResponse.json({ success: true, data: users }, { status: 200 });
  } catch (error) {
    console.error('Company Users GET error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/companies/[id]/users - Criar usuário na empresa
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });

    const companyId = params.id;
    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST'])) {
      return NextResponse.json({ success: false, error: 'Sem permissão' }, { status: 403 });
    }
    if (session.user.role !== 'ADMINISTRADOR' && session.user.company_id !== companyId) {
      return NextResponse.json({ success: false, error: 'Sem permissão para acessar esta empresa' }, { status: 403 });
    }

    const body = await request.json();

    // Normalização: aceita camelCase ou snake_case do front
    const normalized = {
      ...body,
      firstName: body.firstName ?? body.first_name,
      lastName: body.lastName ?? body.last_name,
      // opcional: normalize outros campos se necessário
    };

    // permitir active opcional no parse
    const extendedSchema = userSchema.extend({ active: z.boolean().optional() });
    const validatedData = extendedSchema.parse(normalized);

    // email duplicado
    const existingUser = await prisma.user.findUnique({ where: { email: validatedData.email } });
    if (existingUser) return NextResponse.json({ success: false, error: 'Email já está em uso' }, { status: 400 });

    // verifica empresa
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ success: false, error: 'Empresa não encontrada' }, { status: 404 });

    // senha obrigatória na criação
    if (!validatedData.password) return NextResponse.json({ success: false, error: 'Senha é obrigatória' }, { status: 400 });

    // proteção para criar ADMINISTRADOR
    if (validatedData.role === 'ADMINISTRADOR' && session.user.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ success: false, error: 'Sem permissão para criar administrador' }, { status: 403 });
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // mapear camelCase -> snake_case para o Prisma
    const dataForPrisma = {
      email: validatedData.email,
      password: hashedPassword,
      first_name: validatedData.firstName,
      last_name: validatedData.lastName,
      phone: validatedData.phone ?? null,
      role: validatedData.role,
      company_id: companyId,
      active: validatedData.active ?? true,
    };

    const user = await prisma.user.create({
      data: dataForPrisma,
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

    await createAuditLog({
      company_id: companyId,
      user_id: session.user.id,
      entity_type: 'User',
      entity_id: user.id,
      action: 'CREATE',
      new_values: {
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        active: user.active
      }
    });

    // responder em camelCase
    const resp = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role,
      active: user.active,
      createdAt: user.created_at
    };

    return NextResponse.json({ success: true, message: 'Usuário criado com sucesso!', data: resp }, { status: 201 });
  } catch (error: any) {
    console.error('Company User POST error:', error);
    if (error?.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Dados inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}