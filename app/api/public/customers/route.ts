// app/api/public/customers/find/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id, cnpj_cpf, company_id } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'company_id é obrigatório' }, { status: 400 });
    }

    let customer = null;

    // 1) Se vier user_id, procuramos pelo campo id do customer
    if (user_id) {
      customer = await prisma.customer.findFirst({
        where: {
          id: String(user_id),
          company_id: String(company_id),
        },
        select: {
          id: true,
          email: true,
          cnpj_cpf: true,
          name: true,
          phone: true,
          created_at: true,
          updated_at: true,
        },
      });
    }

    // 2) Se não achar por id e tiver email, fallback por email + company_id
    if (!customer && cnpj_cpf) {
      customer = await prisma.customer.findUnique({
        where: {
          company_id_cnpj_cpf: {
            company_id: String(company_id),
            cnpj_cpf,
          },
        },
        select: {
          id: true,
          email: true,
          cnpj_cpf: true,
          name: true,
          phone: true,
          created_at: true,
          updated_at: true,
        },
      }).catch(async () => {
        // se findUnique falhar por not unique key, tenta findFirst
        return await prisma.customer.findFirst({
          where: { company_id: String(company_id), cnpj_cpf },
          select: {
            id: true,
            cnpj_cpf: true,
            email: true,
            name: true,
            phone: true,
            created_at: true,
            updated_at: true,
          },
        });
      });
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error('[CUSTOMERS_FIND_ERROR]', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}