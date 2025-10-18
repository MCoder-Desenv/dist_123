// app/empresa/[slug]/loginCustomer/page.tsx
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RootProviders } from '@/components/RootProviders';
import LoginCustomer from '@/components/public/login-customer';
import { prisma } from '@/lib/db';

type Props = { params: { slug: string } };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await prisma.company.findUnique({
    where: { slug: params.slug, active: true },
  });
  if (!company) return { title: 'Empresa não encontrada' };
  return { title: `${company.name} - Login`, description: `Entrar na ${company.name}` };
}

export default async function LoginCustomerPage({ params }: Props) {
  const company = await prisma.company.findUnique({
    where: { slug: params.slug, active: true },
    select: { id: true, name: true, logo_url: true, slug: true },
  });

  if (!company) notFound();

  return (
    <RootProviders companyId={company.id}>
      <LoginCustomer
        slug={params.slug}
        company={{
          id: company.id,
          name: company.name,
          slug: company.slug,
          logo_url: company.logo_url ?? undefined,
        }}
      />
    </RootProviders>
  );
}