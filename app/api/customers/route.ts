
import { NextResponse } from 'next/server';
import { getServerAuthSession, getCompanyFilter, getCompanyIdForCreate } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

// GET - Listar clientes da empresa do usuário
export async function GET() {
  try {
    const session = await getServerAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar permissão
    if (!hasPermission(session.user.role as UserRole, 'customers', 'read')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const customers = await prisma.customer.findMany({
      where: {
      ...getCompanyFilter(session),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        created_at: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return NextResponse.json({ data: customers });
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    return NextResponse.json(
      { error: 'Erro ao listar clientes' },
      { status: 500 }
    );
  }
}

// POST - Criar novo cliente
export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar permissão
    if (!hasPermission(session.user.role as UserRole, 'customers', 'create')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const { name, email, phone, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const companyId = getCompanyIdForCreate(session);
    
    // Verificar se já existe cliente com este email na empresa
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

    const hashedPassword = await bcrypt.hash(password, 10);

    const customer = await prisma.customer.create({
      data: {
        company_id: companyId,
        name,
        email: email.toLowerCase(),
        phone,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        created_at: true,
      },
    });

    return NextResponse.json({ data: customer }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    return NextResponse.json(
      { error: 'Erro ao criar cliente' },
      { status: 500 }
    );
  }
}
