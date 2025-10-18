// app/admin/print/admin/pedidos/[id]/imprimir/page.tsx
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession, canAccessCompany } from '@/lib/auth';
import { notFound } from 'next/navigation';
import PrintActions from '@/components/print/print-actions';

type Props = {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const orderId = params.id;
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  const title = order ? `Imprimir Pedido #${String(order.id).slice(0, 8).toUpperCase()}` : 'Imprimir Pedido';
  return { title };
}

export default async function PrintOrderPage({ params, searchParams }: Props) {
  const orderId = params.id;
  const autoPrint = !!searchParams?.autoPrint;
  const mode = typeof searchParams?.mode === 'string' ? searchParams.mode : 'a4'; // 'a4' | 'cupom'

  // Autenticação/Autorização server-side
  const session = await getServerAuthSession();
  if (!session?.user) {
    return new Response('Não autorizado', { status: 401 });
  }

  // Buscar pedido com includes
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      order_items: {
        include: {
          product: { select: { name: true } },
          variant: { select: { name: true } },
        },
      },
      company: { select: { name: true, logo_url: true, address: true } },
      user: { select: { first_name: true, last_name: true } },
    },
  });

  if (!order) return notFound();

  // Verifica permissão por empresa (mesma lógica do backend)
  if (!canAccessCompany(session.user.company_id, order.company_id)) {
    return new Response('Sem permissão para acessar este pedido', { status: 403 });
  }

  const address = (order.delivery_address ?? {}) as any;

  const formatMoney = (n?: number | string) =>
    typeof n === 'number'
      ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : (Number(n || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="print-root">
      <style>{`
        :root { --muted: #666; --text: #111; --brand: #111827; }
        body { font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color: var(--text); margin: 0; padding: 0; }
        .wrap { max-width: ${mode === 'cupom' ? '320px' : '720px'}; margin: 16px auto; padding: ${mode === 'cupom' ? '8px' : '24px'}; }
        header { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom: 12px; }
        .brand { font-weight:700; font-size: ${mode === 'cupom' ? '14px' : '20px'}; }
        .meta { font-size: ${mode === 'cupom' ? '11px' : '13px'}; color: var(--muted); text-align:right; }
        h1 { margin: 0 0 8px 0; font-size: 16px; }
        .customer { margin-bottom: 8px; font-size: ${mode === 'cupom' ? '12px' : '14px'}; }
        table { width: 100%; border-collapse: collapse; font-size: ${mode === 'cupom' ? '12px' : '13px'}; margin-top: 8px; }
        th, td { padding: ${mode === 'cupom' ? '6px 0' : '8px 0'}; text-align:left; }
        thead th { color: var(--muted); font-weight:600; font-size: ${mode === 'cupom' ? '12px' : '13px'}; }
        tbody tr + tr td { border-top: 1px dashed #e6e6e6; }
        .totals { margin-top: 10px; font-size: ${mode === 'cupom' ? '12px' : '14px'}; }
        .totals .row { display:flex; justify-content:space-between; padding:4px 0; }
        .notes { margin-top: 8px; color: var(--muted); white-space: pre-wrap; font-size: ${mode === 'cupom' ? '11px' : '13px'}; }
        .print-actions { margin: 12px 0; display:flex; gap:8px; justify-content:flex-end; }
        .btn { background: #111827; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
        @media print {
          .print-actions { display: none; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: ${mode === 'cupom' ? '2mm' : '8mm'}; }
        }
      `}</style>

      <div className="wrap">
        <PrintActions autoPrint={autoPrint} mode={mode as 'a4' | 'cupom'} />

        <header>
          <div>
            <div className="brand">{order.company?.name ?? 'Minha Distribuidora'}</div>
            <div style={{ fontSize: mode === 'cupom' ? '11px' : '13px', color: 'var(--muted)' }}>
              {order.company?.address || ''}
            </div>
          </div>
          <div className="meta">
            Pedido #{String(order.id).slice(0, 8).toUpperCase()}
            <br />
            {new Date(order.created_at || '').toLocaleString('pt-BR')}
          </div>
        </header>

        <section className="customer">
          <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
          <div style={{ color: 'var(--muted)' }}>
            {order.customer_email}
            {order.customer_phone ? ` · ${order.customer_phone}` : ''}
          </div>
          {order.delivery_type === 'DELIVERY' && (
            <div style={{ color: 'var(--muted)', marginTop: 6 }}>
              {address?.street || address?.address || '-'}
              {address?.city ? `, ${address.city}` : ''}
              {address?.state ? ` - ${address.state}` : ''}
              {address?.zip_code ? ` · CEP ${address.zip_code}` : ''}
            </div>
          )}
          <div style={{ color: 'var(--muted)', marginTop: 6 }}>
            Entrega: {order.delivery_type} · Pagamento: {order.payment_method} · Status: {order.status}
          </div>
        </section>

        <section>
          <table>
            <thead>
              <tr>
                <th style={{ width: '60%' }}>Produto</th>
                <th style={{ width: '10%' }}>Qtd</th>
                <th style={{ width: '15%' }}>Unit.</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items?.map((it: any) => {
                const name = `${it.product?.name ?? ''}${it.variant?.name ? ` (${it.variant.name})` : ''}`;
                return (
                  <tr key={it.id}>
                    <td>{name}</td>
                    <td>{it.quantity}</td>
                    <td>{formatMoney(Number(it.unit_price ?? it.unitPrice ?? 0))}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(Number(it.total_price ?? it.totalPrice ?? 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="totals">
            <div className="row">
              <span>Subtotal</span>
              <strong>{formatMoney(Number(order.subtotal ?? 0))}</strong>
            </div>
            <div className="row">
              <span>Taxa de Entrega</span>
              <strong>{formatMoney(Number(order.delivery_fee ?? 0))}</strong>
            </div>
            <div className="row" style={{ fontSize: mode === 'cupom' ? '13px' : '16px' }}>
              <span>Total</span>
              <strong>{formatMoney(Number(order.total_amount ?? order.total_amount ?? 0))}</strong>
            </div>
          </div>

          {order.notes && <div className="notes">Obs: {order.notes}</div>}
        </section>

        <footer style={{ marginTop: 12, textAlign: 'center', color: 'var(--muted)', fontSize: mode === 'cupom' ? '11px' : '13px' }}>
          Obrigado pela preferência!
        </footer>
      </div>

      {/* <script
        dangerouslySetInnerHTML={{
          __html: `
            // botão de imprimir
            document.getElementById('printBtn')?.addEventListener('click', () => window.print());
            ${autoPrint ? `window.addEventListener('load', () => setTimeout(() => window.print(), 300));` : ''}
          `,
        }}
      /> */}
    </div>
  );
}