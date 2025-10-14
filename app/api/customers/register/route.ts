
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { email, password, name, phone, company_id } = await request.json();

    if (!email || !password || !name || !company_id) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      );
    }

    // Verificar se já existe
    const existing = await prisma.customer.findUnique({
      where: {
        company_id_email: {
          company_id,
          email: email.toLowerCase(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Cliente já cadastrado' },
        { status: 400 }
      );
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar cliente
    const customer = await prisma.customer.create({
      data: {
        company_id,
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        phone: phone || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Register customer error:', error);
    return NextResponse.json(
      { error: 'Erro ao cadastrar cliente' },
      { status: 500 }
    );
  }
}
