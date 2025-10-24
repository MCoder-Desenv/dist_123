// app/api/customers/register/route.ts (ou o arquivo onde você tratava o POST)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

/**
 * POST /api/customers/register
 * Body: { email?, cnpj_cpf, password, name, phone?, company_id }
 * Retorna:
 * - 201 + customer (select)
 * - 400 + { error, field? } para validação
 * - 409 + { error } quando cliente já existe
 * - 500 + { error } para erro interno
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, cnpj_cpf, password, name, phone, company_id } = body;

    // Validações básicas
    if (!company_id) {
      return NextResponse.json({ error: 'company_id é obrigatório', field: 'company_id' }, { status: 400 });
    }

    if (!name || String(name).trim().length < 2) {
      return NextResponse.json({ error: 'Nome é obrigatório e deve ter ao menos 2 caracteres', field: 'name' }, { status: 400 });
    }

    if (!password || String(password).length < 6) {
      return NextResponse.json({ error: 'Senha é obrigatória e deve ter ao menos 6 caracteres', field: 'password' }, { status: 400 });
    }

    if (!cnpj_cpf || typeof cnpj_cpf !== 'string') {
      return NextResponse.json({ error: 'CPF/CNPJ é obrigatório', field: 'cnpj_cpf' }, { status: 400 });
    }

    const onlyDigits = cnpj_cpf.replace(/\D/g, '');
    if (!(onlyDigits.length === 11 || onlyDigits.length === 14)) {
      return NextResponse.json({ error: 'CPF/CNPJ inválido (11 ou 14 dígitos esperados)', field: 'cnpj_cpf' }, { status: 400 });
    }

    // email opcional, mas se informado validar formato simples
    if (email && typeof email === 'string') {
      const normalizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return NextResponse.json({ error: 'E-mail inválido', field: 'email' }, { status: 400 });
      }
    }

    // Normaliza o cnpj_cpf que será armazenado/consultado
    const normalizedCnpjCpf = onlyDigits;

    // Verificar se já existe para a mesma company_id
    const existing = await prisma.customer.findUnique({
      where: {
        company_id_cnpj_cpf: {
          company_id,
          cnpj_cpf: normalizedCnpjCpf,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Cliente já cadastrado' }, { status: 409 });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar cliente
    const customer = await prisma.customer.create({
      data: {
        company_id,
        cnpj_cpf: normalizedCnpjCpf,
        email: email ? String(email).toLowerCase() : null,
        password: hashedPassword,
        name: String(name).trim(),
        phone: phone ? String(phone) : null,
      },
      select: {
        id: true,
        cnpj_cpf: true,
        email: true,
        name: true,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Register customer error:', error);
    return NextResponse.json(
      { error: 'Erro ao cadastrar cliente' },
      { status: 500 }
    );
  }
}