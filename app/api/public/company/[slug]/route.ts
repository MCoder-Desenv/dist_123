
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/public/company/[slug] - Obter dados públicos da empresa
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const companySlug = params.slug;

    // Buscar empresa pelo slug
    const company = await prisma.company.findUnique({
      where: { 
        slug: companySlug,
        active: true 
      },
      select: {
        id: true,
        name: true,
        logo_url: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        state: true,
        zip_code: true
      }
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: company
    });

  } catch (error) {
    console.error('Public company GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
