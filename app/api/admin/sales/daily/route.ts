import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Últimos 30 dias em horário local (inclui hoje)
function getLast30DaysRangeLocal() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

// Normaliza data JS -> 'YYYY-MM-DD' em local time
function toLocalYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.company_id) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const companyId = session.user.company_id;
    const { start, end } = getLast30DaysRangeLocal();

    // Defina os status concluídos exatamente como estão no enum
    // Exemplos comuns: RECEBIDO, EM_SEPARACAO, EM_ROTA, ENTREGUE, CONCLUIDO, CANCELADO...
    // Ajuste abaixo para os que devem contar como "concluídos".
    const COMPLETED_STATUSES: OrderStatus[] = [OrderStatus.ENTREGUE];

    // Buscar somente os campos necessários no range
    const orders = await prisma.order.findMany({
      where: {
        company_id: companyId,
        created_at: {
          gte: start,
          lte: end,
        },
        status: { in: COMPLETED_STATUSES },
      },
      select: {
        created_at: true,
        total_amount: true, // Decimal(10,2)
      },
      orderBy: { created_at: 'asc' },
    });

    // Agregar por dia em memória
    const agg = new Map<string, { value: number; orders: number }>();
    for (const o of orders) {
      // o.created_at é UTC no banco; ao instanciar como Date em JS, usamos local na formatação de dia.
      const key = toLocalYMD(o.created_at);
      const prev = agg.get(key) || { value: 0, orders: 0 };
      prev.value += Number(o.total_amount || 0);
      prev.orders += 1;
      agg.set(key, prev);
    }

    // Preencher os 30 dias
    const out: { date: string; value: number; orders: number }[] = [];
    const cursor = new Date(start);
    const labelFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short', day: 'numeric' });

    for (let i = 0; i < 30; i++) {
      const key = toLocalYMD(cursor);
      const v = agg.get(key);
      out.push({
        date: labelFmt.format(cursor),
        value: v?.value ?? 0,
        orders: v?.orders ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return NextResponse.json({ success: true, data: out });
  } catch (error) {
    console.error('Sales daily GET error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}