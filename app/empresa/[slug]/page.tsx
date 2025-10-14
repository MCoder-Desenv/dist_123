import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ClientProviders from '@/components/ClientProviders';
import { PublicMenu } from '@/components/public/public-menu';
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
    title: `${company.name} - Cardápio Online`,
    description: `Peça online na ${company.name}. Bebidas e produtos com entrega rápida.`,
  };
}

export default async function PublicMenuPage({ params }: Props) {
  const company = await prisma.company.findUnique({
    where: { slug: params.slug, active: true },
    select: {
      id: true,
      name: true,
      logo_url: true,
      phone: true,
      address: true,
      city: true,
      state: true,
    },
  });

  if (!company) {
    notFound();
  }

  return (
    <ClientProviders companyId={company.id}>
      <PublicMenu
        slug={params.slug}
        company={{
          ...company,
          logo_url: company.logo_url ?? undefined,
          phone: company.phone ?? undefined,
          address: company.address ?? undefined,
          city: company.city ?? undefined,
          state: company.state ?? undefined,
        }}
      />
    </ClientProviders>
  );
}