import { Metadata } from 'next';
import { getServerAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ProductManagement } from '@/components/admin/product-management';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Produtos - Sistema Distribuidora',
  description: 'Gestão de produtos da distribuidora',
};

export default async function ProdutosPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Produtos
        </h1>
        <p className="mt-2 text-gray-600">
          Gerencie o catálogo de produtos da sua distribuidora
        </p>
      </div>

      <ProductManagement />
    </div>
  );
}
