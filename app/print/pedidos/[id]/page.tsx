// app/admin/print/admin/pedidos/[id]/imprimir/page.tsx
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession, canAccessCompany } from '@/lib/auth';
import { notFound } from 'next/navigation';
import PrintActions from '@/components/print/print-actions';
import '@/app/print/print.css';

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

  // 💰 Formata valores monetários
  const formatMoney = (n?: number | string) =>
    typeof n === 'number'
      ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : (Number(n || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // 🧾 Formata CPF/CNPJ automaticamente
  const formatCpfCnpj = (value?: string | null) => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    if (digits.length === 11) {
      // CPF
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (digits.length === 14) {
      // CNPJ
      return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return value; // retorna original se não for CPF nem CNPJ
  };

  const cpfCnpj = formatCpfCnpj(order.customer_cnpj_cpf);

  return (
    <div className={`print-root ${mode === 'cupom' ? 'mode-cupom' : 'mode-a4'}`}>
      <div className="wrap">
        <PrintActions autoPrint={autoPrint} mode={mode as 'a4' | 'cupom'} />

        <header>
          <div>
            <div className="brand">{order.company?.name ?? 'Minha Distribuidora'}</div>
            <div className="address">{order.company?.address || ''}</div>
          </div>
          <div className="meta">
            Pedido #{String(order.id).slice(0, 8).toUpperCase()}
            <br />
            {new Date(order.created_at || '').toLocaleString('pt-BR')}
          </div>
        </header>

        <section className="customer">
          <div style={{ fontWeight: 600 }}>
            {order.customer_name}
            {cpfCnpj && ` · ${cpfCnpj}`}
          </div>
          <div className="muted">
            {order.customer_email}
            {order.customer_phone ? ` · ${order.customer_phone}` : ''}
          </div>
          {order.delivery_type === 'DELIVERY' && (
            <div className="muted" style={{ marginTop: 6 }}>
              {address?.street || address?.address || '-'}
              {address?.city ? `, ${address.city}` : ''}
              {address?.state ? ` - ${address.state}` : ''}
              {address?.zip_code ? ` · CEP ${address.zip_code}` : ''}
            </div>
          )}
          <div className="muted" style={{ marginTop: 6 }}>
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
                    <td>{formatMoney(it.unit_price)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(it.total_price)}</td>
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
            {/* <div className="row">
              <span>Taxa de Entrega</span>
              <strong>{formatMoney(Number(order.delivery_fee ?? 0))}</strong>
            </div> */}
            <div className="row total-row">
              <span>Total</span>
              <strong>{formatMoney(Number(order.total_amount ?? order.total_amount ?? 0))}</strong>
            </div>
          </div>

          {order.notes && <div className="notes">Obs: {order.notes}</div>}
        </section>

        <footer className="footer">
          Obrigado pela preferência!
        </footer>
      </div>
    </div>
  );
}