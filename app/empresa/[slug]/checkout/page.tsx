import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RootProviders } from '@/components/RootProviders';
import { CheckoutPage } from '@/components/public/checkout-page';
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
    title: `Checkout - ${company.name}`,
    description: `Finalize seu pedido na ${company.name}`,
  };
}

export default async function CheckoutPageRoute({ params }: Props) {
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
    <RootProviders companyId={company.id}>
      <CheckoutPage
        company={{
          ...company,
          logo_url: company.logo_url ?? undefined,
        }}
      />
    </RootProviders>
  );
}