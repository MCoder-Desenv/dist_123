import { Metadata } from 'next';
import { getServerAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { OrderManagement } from '@/components/admin/order-management';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pedidos - Sistema Distribuidora',
  description: 'Gestão de pedidos da distribuidora',
};

export default async function PedidosPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Pedidos
        </h1>
        <p className="mt-2 text-gray-600">
          Gerencie todos os pedidos da sua distribuidora
        </p>
      </div>

      <OrderManagement />
    </div>
  );
}
