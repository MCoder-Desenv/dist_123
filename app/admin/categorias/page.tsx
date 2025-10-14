import { Metadata } from 'next';
import { getServerAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CategoryManagement } from '@/components/admin/category-management';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Categorias - Sistema Distribuidora',
  description: 'Gestão de categorias da distribuidora',
};

export default async function CategoriasPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  // Apenas administrador, sub_master e master_dist podem acessar
  if (!['ADMINISTRADOR', 'SUB_MASTER', 'MASTER_DIST'].includes(session.user.role)) {
    redirect('/admin');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Categorias
        </h1>
        <p className="mt-2 text-gray-600">
          Gerencie as categorias de produtos da sua distribuidora
        </p>
      </div>

      <CategoryManagement />
    </div>
  );
}
