
import { Metadata } from 'next';
import { getServerAuthSession } from '@/lib/auth';
import { DashboardStats } from '@/components/admin/dashboard-stats';
import { RecentOrders } from '@/components/admin/recent-orders';
import { SalesChart } from '@/components/admin/sales-chart';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard - Sistema Distribuidora',
  description: 'Dashboard principal do sistema de distribuidora',
};

export default async function AdminDashboard() {
  const session = await getServerAuthSession();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Dashboard
        </h1>
        <p className="mt-2 text-gray-600">
          Bem-vindo de volta, {session?.user?.name}!
        </p>
      </div>

      <DashboardStats />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Vendas dos Últimos 30 Dias
          </h3>
          <SalesChart />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Pedidos Recentes
          </h3>
          <RecentOrders />
        </div>
      </div>
    </div>
  );
}
