'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { formatCurrency, formatDateTime, getOrderStatusColor, getOrderStatusLabel } from '@/lib/utils';
import { Clock, Eye } from 'lucide-react';
import Link from 'next/link';

interface OrderItemBrief {
  quantity: number;
  product: { name: string };
}

interface RecentOrderDTO {
  id: string;
  customer_name: string;
  status: string;
  total: number;         // mapeado na API como Number(order.total_amount)
  created_at: string;    // ISO
  order_items?: OrderItemBrief[];
}

export function RecentOrders() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<RecentOrderDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const didInitialFetch = useRef(false);

  const fetchRecentOrders = async () => {
    if (!session?.user) return;
    setIsLoading(true);
    setError(null);
    try {
      // limitar a 5, já ordenado desc pela API
      const response = await fetch('/api/orders?limit=5', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data.success) {
        // a rota já retorna os campos mapeados; só garantimos defaults
        setOrders((data.data || []).map((o: any) => ({
          id: o.id,
          customer_name: o.customer_name,
          status: o.status,
          total: Number(o.total ?? 0),
          created_at: o.created_at,
          order_items: o.order_items || [],
        })));
      } else {
        setError(data?.error || 'Erro ao buscar pedidos recentes');
        setOrders([]);
      }
    } catch (err) {
      console.error('Erro ao buscar pedidos recentes:', err);
      setError('Erro de rede ao buscar pedidos recentes');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (didInitialFetch.current) return; // evita duplo fetch no StrictMode
    didInitialFetch.current = true;
    fetchRecentOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="border rounded-lg p-4 animate-pulse">
            <div className="flex justify-between items-start mb-2">
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="h-6 bg-gray-200 rounded w-20"></div>
            </div>
            <div className="h-3 bg-gray-200 rounded w-48 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!orders?.length) {
    return (
      <div className="text-center py-8">
        <Clock className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          Nenhum pedido recente
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Os pedidos aparecerão aqui quando forem criados
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-medium text-gray-900">
              {order.customer_name}
            </h4>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getOrderStatusColor(order.status)}`}>
                {getOrderStatusLabel(order.status)}
              </span>

              <Link
                href={`/admin/pedidos?open=${order.id}`}
                className="inline-flex items-center text-blue-600 hover:text-blue-800"
                title="Ver pedido"
              >
                <Eye className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {order.order_items && order.order_items.length > 0 && (
            <p className="text-sm text-gray-600 mb-2">
              <>
                {order.order_items[0].quantity}x {order.order_items[0].product.name}
                {order.order_items.length > 1 && (
                  <span className="text-gray-400">
                    {' '}+ {order.order_items.length - 1} outros
                  </span>
                )}
              </>
            </p>
          )}

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">
              {formatDateTime(order.created_at)}
            </span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(order.total)}
            </span>
          </div>
        </div>
      ))}

      <div className="text-center pt-4">
        <Link
          href="/admin/pedidos"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Ver todos os pedidos →
        </Link>
      </div>
    </div>
  );
}