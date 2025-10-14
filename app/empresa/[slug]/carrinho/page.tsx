
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CartPage } from '@/components/public/cart-page';
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
    title: `Carrinho - ${company.name}`,
    description: `Finalize seu pedido na ${company.name}`,
  };
}

export default async function CarrinhoPage({ params }: Props) {
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

  return <CartPage company={{
    ...company,
    logo_url: company.logo_url ?? undefined,
  }} />;
}
