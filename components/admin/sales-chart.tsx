'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { formatCurrency } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SalesData {
  date: string;   // label (ex: "12 de out.")
  value: number;  // soma de vendas do dia
  orders: number; // qtde de pedidos do dia
}

export function SalesChart() {
  const { data: session, status } = useSession();
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const didInitialFetch = useRef(false);

  const fetchSalesData = async () => {
    if (!session?.user) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sales/daily', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.success) {
        setSalesData(json.data as SalesData[]);
      } else {
        setError(json?.error || 'Erro ao buscar dados de vendas');
        setSalesData([]);
      }
    } catch (err) {
      console.error('Erro ao buscar dados de vendas:', err);
      setError('Erro de rede ao buscar dados de vendas');
      setSalesData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (didInitialFetch.current) return; // evita duplo fetch no StrictMode
    didInitialFetch.current = true;
    fetchSalesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="space-y-2">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-7 gap-2">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={salesData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: number, name) => {
              if (name === 'value') return [formatCurrency(value), 'Vendas'];
              if (name === 'orders') return [value, 'Pedidos'];
              return [value, name];
            }}
            labelStyle={{ fontSize: '12px' }}
            contentStyle={{ fontSize: '12px' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
          />
          {/*
          Se quiser exibir a série de pedidos (contagem), descomente:
          <Line
            type="monotone"
            dataKey="orders"
            stroke="#10B981"
            strokeWidth={2}
            dot={false}
          />
          */}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}