
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { cnpj_cpf, company_id } = await request.json();

    if (!cnpj_cpf || !company_id) {
      return NextResponse.json(
        { error: 'CNPJ e company_id são obrigatórios' },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: {
        company_id_cnpj_cpf: {
          company_id,
          cnpj_cpf,
        },
      },
      select: {
        id: true,
        email: true,
        cnpj_cpf: true,
        name: true,
      },
    });

    return NextResponse.json({ 
      exists: !!customer,
      customer: customer || null,
    });
  } catch (error) {
    console.error('Check customer error:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar cliente' },
      { status: 500 }
    );
  }
}
