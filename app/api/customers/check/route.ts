
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { email, company_id } = await request.json();

    if (!email || !company_id) {
      return NextResponse.json(
        { error: 'Email e company_id são obrigatórios' },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: {
        company_id_email: {
          company_id,
          email: email.toLowerCase(),
        },
      },
      select: {
        id: true,
        email: true,
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
