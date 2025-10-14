
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signupSchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar dados de entrada
    const validatedData = signupSchema.parse(body);

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
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Criar empresa primeiro
    const slug = validatedData.companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    // Verificar se slug já existe
    let finalSlug = slug;
    let counter = 1;
    while (await prisma.company.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    const company = await prisma.company.create({
      data: {
        name: validatedData.companyName,
        slug: finalSlug,
        email: validatedData.email,
        active: true
      }
    });

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        first_name: validatedData.firstName,
        last_name: validatedData.lastName,
        phone: validatedData.phone,
        company_id: company.id,
        role: 'ADMINISTRADOR', // Primeiro usuário é sempre admin
        active: true
      }
    });

    // Log de auditoria
    await createAuditLog({
      company_id: company.id,
      user_id: user.id,
      entity_type: 'User',
      entity_id: user.id,
      action: 'CREATE',
      new_values: {
        email: user.email,
        role: user.role,
        company: company.name
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Conta criada com sucesso!',
      data: {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role
        },
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug
        }
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    
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
