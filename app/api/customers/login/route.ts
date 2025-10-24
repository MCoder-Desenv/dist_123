// src/app/api/customers/login/route.ts (ou onde estiver o handler)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { cnpj_cpf, password, company_id } = body ?? {};

    // normaliza
    cnpj_cpf = typeof cnpj_cpf === 'string' ? cnpj_cpf.replace(/\D/g, '') : '';
    password = typeof password === 'string' ? password : '';
    company_id = typeof company_id === 'string' ? company_id : '';

    if (!cnpj_cpf || !password || !company_id) {
      return NextResponse.json(
        { error: 'CPF/CNPJ, senha e empresa são obrigatórios.' },
        { status: 400 }
      );
    }

    // Buscar cliente por CPF/CNPJ e empresa
    const customer = await prisma.customer.findUnique({
      where: {
        company_id_cnpj_cpf: {
          company_id,
          cnpj_cpf,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        cnpj_cpf: true,
        phone: true,
        active: true,
        password: true, // necessário apenas para validação
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Caso 1: CPF/CNPJ não cadastrado para essa empresa
    if (!customer) {
      return NextResponse.json(
        {
          error: 'CPF/CNPJ não cadastrado para esta empresa. Deseja criar uma conta?',
          suggestion: 'Acesse a página de cadastro da empresa para registrar um novo cliente.',
        },
        { status: 404 }
      );
    }

    // Caso 2: conta desativada
    if (!customer.active) {
      return NextResponse.json(
        { error: 'Conta desativada. Entre em contato com a empresa para reativá-la.' },
        { status: 403 }
      );
    }

    // Caso 3: senha incorreta
    const validPassword = await bcrypt.compare(password, customer.password);
    if (!validPassword) {
      // Aqui poderíamos incrementar um contador de tentativas e bloquear temporariamente, sugerido abaixo.
      return NextResponse.json(
        {
          error: 'Senha incorreta.',
          suggestion: 'Se esqueceu a senha, entre em contato com o suporte da empresa para recuperação ou redefinição.',
        },
        { status: 401 }
      );
    }

    // Sucesso: remover password antes de retornar
    const { password: _pwd, ...customerData } = customer;

    return NextResponse.json(customerData);
  } catch (error) {
    console.error('Login customer error:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer login' },
      { status: 500 }
    );
  }
}