
import { Metadata } from 'next';
import { getServerAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminManagement } from '@/components/admin/admin-management';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Administradores - Sistema Distribuidora',
  description: 'Gestão de Administradores do sistema',
};

export default async function AdministradoresPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  // Apenas administrador, sub_master e master_dist podem acessar
  if (!['ADMINISTRADOR', 'SUB_MASTER'].includes(session.user.role)) {
    redirect('/admin');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Gestão de Administradores
        </h1>
        <p className="mt-2 text-gray-600">
          Gerencie os Administradores
        </p>
      </div>

      <AdminManagement />
    </div>
  );
}
