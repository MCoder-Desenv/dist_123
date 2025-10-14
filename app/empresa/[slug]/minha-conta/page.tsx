// app/empresa/[slug]/minha-conta/page.tsx
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ClientProviders from '@/components/ClientProviders'; // ajuste o caminho se necessário
import { CustomerAccount } from '@/components/public/customer-account';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Props = {
  params: { slug: string };
};

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
    title: `Minha Conta - ${company.name}`,
    description: `Área do cliente da ${company.name}`,
  };
}

export default async function CustomerAccountPage({ params }: Props) {
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
      <CustomerAccount
        company={{
          id: company.id,
          name: company.name,
          slug: company.slug,
          logo_url: company.logo_url ?? undefined,
        }}
      />
    </ClientProviders>
  );
}