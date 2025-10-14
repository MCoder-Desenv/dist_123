import { Metadata } from 'next';
import { getServerAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ReportsPage as ReportsPageComponent } from '@/components/admin/reports-page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Relatórios - Sistema Distribuidora',
  description: 'Relatórios e exportações do sistema',
};

export default async function RelatoriosPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Relatórios
        </h1>
        <p className="mt-2 text-gray-600">
          Visualize e exporte relatórios do sistema
        </p>
      </div>

      <ReportsPageComponent />
    </div>
  );
}