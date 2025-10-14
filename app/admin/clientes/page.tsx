

import { Metadata } from 'next';
import { getServerAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { CustomerManagement } from '@/components/admin/customer-management';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clientes - Sistema Distribuidora',
  description: 'Gestão de clientes',
};

export default async function ClientesPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  // Verificar permissão
  if (!hasPermission(session.user.role as UserRole, 'customers', 'read')) {
    redirect('/admin');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Gestão de Clientes
        </h1>
        <p className="mt-2 text-gray-600">
          Gerencie os clientes da sua distribuidora
        </p>
      </div>

      <CustomerManagement />
    </div>
  );
}
