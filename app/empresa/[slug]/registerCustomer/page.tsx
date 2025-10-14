// app/empresa/[slug]/registerCustomer/page.tsx
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ClientProviders from '@/components/ClientProviders';
import RegisterCustomer from '@/components/public/register-customer';
import { prisma } from '@/lib/db';

type Props = {
  params: { slug: string };
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await prisma.company.findUnique({
    where: { slug: params.slug, active: true },
  });

  if (!company) {
    return {
      title: 'Empresa não encontrada',
    };
  }

  return {
    title: `${company.name} - Cadastro do Cliente`,
    description: `Crie sua conta para comprar na ${company.name}`,
  };
}

export default async function RegisterCustomerPage({ params }: Props) {
  const company = await prisma.company.findUnique({
    where: { slug: params.slug, active: true },
    select: {
      id: true,
      name: true,
      logo_url: true,
      slug: true,
    },
  });

  if (!company) {
    notFound();
  }

  return (
    <ClientProviders companyId={company.id}>
      <RegisterCustomer
        slug={params.slug}
        company={{
          id: company.id,
          name: company.name,
          slug: company.slug,
          // converte null -> undefined para satisfazer o tipo esperado
          logo_url: company.logo_url ?? undefined,
        }}
      />
    </ClientProviders>
  );
}