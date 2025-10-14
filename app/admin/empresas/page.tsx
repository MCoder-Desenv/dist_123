
import { Metadata } from 'next';
import { getServerAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CompanyManagement } from '@/components/admin/company-management';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Empresas - Sistema Distribuidora',
  description: 'Gestão de empresas multi-tenant',
};

export default async function EmpresasPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  // Apenas ADMINISTRADOR e SUB_MASTER podem acessar
  if (!['ADMINISTRADOR', 'SUB_MASTER'].includes(session.user.role)) {
    redirect('/admin');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Gestão de Empresas
        </h1>
        <p className="mt-2 text-gray-600">
          Configure as empresas do sistema multi-tenant
        </p>
      </div>

      <CompanyManagement />
    </div>
  );
}
