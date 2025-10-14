
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, getCompanyIdForCreate } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { companySchema, userSchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET /api/companies - Listar empresas (apenas ADMINISTRADOR)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Apenas ADMINISTRADOR pode acessar
    if (session.user.role !== 'ADMINISTRADOR') {
      return NextResponse.json(
        { success: false, error: 'Acesso negado. Apenas administradores podem gerenciar empresas.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          phone: true,
          logo_url: true,
          active: true,
          created_at: true,
          _count: {
            select: {
              users: true,
              products: true,
              orders: true
            }
          }
        }
      }),
      prisma.company.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Companies GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/companies - Criar nova empresa (apenas ADMINISTRADOR)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    // Apenas administradores criam empresas
    if (session.user.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ success: false, error: 'Acesso negado. Apenas administradores podem criar empresas.' }, { status: 403 });
    }

    const body = await request.json();
    const { master_user, ...companyData } = body;

    // Tipagem segura: companySchema já exige `active`
    type CompanyInput = z.infer<typeof companySchema>;
    const validatedCompany = companySchema.parse(companyData) as CompanyInput;

    // Checar slug duplicado
    const existingSlug = await prisma.company.findUnique({ where: { slug: validatedCompany.slug } });
    if (existingSlug) {
      return NextResponse.json({ success: false, error: 'Slug já está em uso' }, { status: 400 });
    }

    // Se master_user foi enviado, validar e normalizar (aceita camelCase ou snake_case)
    let normalizedMaster: any = undefined;
    if (master_user) {
      normalizedMaster = {
        ...master_user,
        firstName: master_user.firstName ?? master_user.first_name,
        lastName: master_user.lastName ?? master_user.last_name,
      };

      // Criar schema de criação de usuário a partir do userSchema existente
      const createUserSchema = userSchema
        .pick({ email: true, password: true, firstName: true, lastName: true, phone: true, role: true, active: true })
        .extend({
          role: z
            .union([
              z.literal('MASTER_DIST'),
              z.literal('ADMINISTRADOR'),
              z.literal('SUB_MASTER'),
              z.literal('ATENDENTE'),
              z.literal('FINANCEIRO'),
              z.literal('LEITURA')
            ])
            .optional(),
          active: z.boolean().optional()
        });

      normalizedMaster = createUserSchema.parse(normalizedMaster);

      // checar email duplicado
      const existingUserEmail = await prisma.user.findUnique({ where: { email: normalizedMaster.email } });
      if (existingUserEmail) {
        return NextResponse.json({ success: false, error: 'E-mail do Master_Dist já está em uso' }, { status: 400 });
      }

      if (!normalizedMaster.password) {
        return NextResponse.json({ success: false, error: 'Senha do Master_Dist é obrigatória' }, { status: 400 });
      }
    }

    // Criar empresa (e opcionalmente usuário) em transação
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: validatedCompany.name,
          slug: validatedCompany.slug,
          cnpj_cpf: validatedCompany.cnpj_cpf ?? null,
          email: validatedCompany.email ?? null,
          phone: validatedCompany.phone ?? null,
          address: validatedCompany.address ?? null,
          city: validatedCompany.city ?? null,
          state: validatedCompany.state ?? null,
          zip_code: validatedCompany.zip_code ?? null,
          active: validatedCompany.active // já é boolean por causa do schema
        }
      });

      let masterDistUser = null;
      if (normalizedMaster) {
        const hashedPassword = await bcrypt.hash(normalizedMaster.password, 12);
        masterDistUser = await tx.user.create({
          data: {
            company_id: company.id,
            email: normalizedMaster.email,
            password: hashedPassword,
            first_name: normalizedMaster.firstName,
            last_name: normalizedMaster.lastName,
            phone: normalizedMaster.phone ?? null,
            role: normalizedMaster.role ?? 'MASTER_DIST',
            active: typeof normalizedMaster.active === 'boolean' ? normalizedMaster.active : true,
            is_primary_admin: false
          }
        });
      }

      return { company, masterDistUser };
    });

    // Auditoria
    await createAuditLog({
      company_id: result.company.id,
      user_id: session.user.id,
      entity_type: 'Company',
      entity_id: result.company.id,
      action: 'CREATE',
      new_values: validatedCompany
    });

    // Responder com a company criada (padrão devolver campos principais)
    const respCompany = {
      id: result.company.id,
      name: result.company.name,
      slug: result.company.slug,
      cnpj_cpf: result.company.cnpj_cpf,
      email: result.company.email,
      phone: result.company.phone,
      logo_url: result.company.logo_url ?? null,
      active: result.company.active,
      created_at: result.company.created_at
    };

    return NextResponse.json({
      success: true,
      message: master_user ? 'Empresa e Master_Dist criados com sucesso!' : 'Empresa criada com sucesso!',
      data: respCompany
    }, { status: 201 });

  } catch (error: any) {
    console.error('Companies POST error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Dados inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
