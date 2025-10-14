import { Metadata } from 'next';
import { getServerAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FinancialManagement } from '@/components/admin/financial-management';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Financeiro - Sistema Distribuidora',
  description: 'Gestão financeira da distribuidora',
};


export default async function FinanceiroPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  // Verificar permissão
  if (!['ADMINISTRADOR', 'SUB_MASTER', 'MASTER_DIST', 'FINANCEIRO', 'LEITURA'].includes(session.user.role)) {
    redirect('/admin');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Financeiro
        </h1>
        <p className="mt-2 text-gray-600">
          Gerencie as finanças da sua distribuidora
        </p>
      </div>

      <FinancialManagement />
    </div>
  );
}