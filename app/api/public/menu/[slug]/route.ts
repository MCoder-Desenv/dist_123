
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/public/menu/[slug] - Obter cardápio público da empresa
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
        state: true
      }
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Cardápio não encontrado' },
        { status: 404 }
      );
    }

    // Buscar categorias e produtos ativos
    const categories = await prisma.category.findMany({
      where: {
        company_id: company.id,
        active: true
      },
      orderBy: { sort_order: 'asc' },
      include: {
        products: {
          where: { active: true },
          orderBy: { sort_order: 'asc' },
          include: {
            variants: {
              where: { active: true },
              orderBy: { name: 'asc' }
            }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        company,
        categories
      }
    });

  } catch (error) {
    console.error('Public menu GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
