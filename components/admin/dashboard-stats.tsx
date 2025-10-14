'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { formatCurrency } from '@/lib/utils';
import { ShoppingCart, DollarSign, Package, TrendingUp } from 'lucide-react';

interface StatsData {
  total_orders: number;
  orders_today: number;
  total_revenue: number;
  revenue_today: number;
  total_products: number;
  pending_orders: number;
}

export function DashboardStats() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<StatsData>({
    total_orders: 0,
    orders_today: 0,
    total_revenue: 0,
    revenue_today: 0,
    total_products: 0,
    pending_orders: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const didInitialFetch = useRef(false);
  const isFetching = useRef(false);

  const fetchStats = async (opts?: { startDate?: string; endDate?: string }) => {
    if (!session?.user) return;
    if (isFetching.current) return; // evita chamadas concorrentes
    isFetching.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      const s = opts?.startDate ?? startDate;
      const e = opts?.endDate ?? endDate;

      if (s) params.set('start_date', s);
      if (e) params.set('end_date', e);

      const url = `/api/admin/stats${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();

      if (res.ok && json.success) {
        setStats(json.data);
      } else {
        setError(json?.error || 'Erro ao buscar estatísticas');
        console.error('Erro ao buscar estatísticas:', json);
      }
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
      setError('Erro de rede ao buscar estatísticas');
    } finally {
      isFetching.current = false;
      setIsLoading(false);
    }
  };

  // Fetch inicial: apenas uma vez quando a sessão estiver pronta
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (didInitialFetch.current) return; // evita duplo fetch no StrictMode
    didInitialFetch.current = true;
    fetchStats({ startDate: '', endDate: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    // validação simples
    if (startDate && endDate && startDate > endDate) {
      setError('Data inicial não pode ser maior que a final.');
      return;
    }
    fetchStats({ startDate, endDate });
  };

  const clearFilter = () => {
    setStartDate('');
    setEndDate('');
    fetchStats({ startDate: '', endDate: '' });
  };

  const statCards = [
    {
      title: 'Pedidos',
      value: `${stats.orders_today} hoje`,
      total: `${stats.total_orders} todo o período`,
      icon: ShoppingCart,
      color: 'bg-blue-500',
      change: '+12%',
    },
    {
      title: 'Receita',
      value: `${formatCurrency(stats.revenue_today)} hoje`,
      total: `${formatCurrency(stats.total_revenue)} ao total`,
      icon: DollarSign,
      color: 'bg-green-500',
      change: '+8%',
    },
    {
      title: 'Produtos',
      value: stats.total_products,
      total: 'ativos no catálogo',
      icon: Package,
      color: 'bg-purple-500',
      change: '+3',
    },
    {
      title: 'Pendentes',
      value: stats.pending_orders,
      total: 'aguardando processamento',
      icon: TrendingUp,
      color: 'bg-orange-500',
      change: '-2',
    },
  ];

  return (
    <div className="space-y-6">
      <form onSubmit={handleFilter} className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm text-gray-600">De</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600">Até</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            Filtrar
          </button>
          <button type="button" onClick={clearFilter} className="bg-gray-200 px-4 py-2 rounded">
            Limpar
          </button>
        </div>

        {error && <div className="text-sm text-red-600 ml-4">{error}</div>}
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading
          ? [...Array(4)].map((_, index) => (
              <div key={index} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                  </div>
                  <div className="h-12 w-12 bg-gray-200 rounded-lg"></div>
                </div>
              </div>
            ))
          : statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
                      <p className="text-xs text-gray-500">{stat.total}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}