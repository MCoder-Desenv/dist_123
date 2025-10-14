
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { email, password, company_id } = await request.json();

    if (!email || !password || !company_id) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      );
    }

    // Buscar cliente
    const customer = await prisma.customer.findUnique({
      where: {
        company_id_email: {
          company_id,
          email: email.toLowerCase(),
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Email ou senha incorretos' },
        { status: 401 }
      );
    }

    // Verificar senha
    const validPassword = await bcrypt.compare(password, customer.password);
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Email ou senha incorretos' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      id: customer.id,
      email: customer.email,
      name: customer.name,
    });
  } catch (error) {
    console.error('Login customer error:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer login' },
      { status: 500 }
    );
  }
}
