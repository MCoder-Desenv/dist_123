'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Eye, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';

interface OrderItem {
  id: string;
  product_name: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product_id?: string;
  variant_id?: string | null;
}

interface Order {
  id?: string; // opcional para suportar "novo pedido" no Dialog
  order_number?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  delivery_type: string;
  payment_method: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  notes?: string | null;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  created_at?: string;
  items?: OrderItem[];
  company_id?: string;
}

const STATUS_OPTIONS = [
  { value: 'RECEBIDO', label: 'Recebido', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'EM_SEPARACAO', label: 'Em Separação', color: 'bg-blue-100 text-blue-800' },
  { value: 'PRONTO', label: 'Pronto', color: 'bg-green-100 text-green-800' },
  { value: 'EM_ROTA', label: 'Em Rota', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'ENTREGUE', label: 'Entregue', color: 'bg-green-600 text-white' },
  { value: 'CANCELADO', label: 'Cancelado', color: 'bg-red-100 text-red-800' },
];

const PAYMENT_METHODS: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  CASH: 'Dinheiro',
  BANK_TRANSFER: 'Transferência',
};

const DELIVERY_TYPES: Record<string, string> = {
  DELIVERY: 'Entrega',
  RETIRADA: 'Retirada',
};

export function OrderManagement() {
  const { data: session } = useSession() || {};
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog
  const [saving, setSaving] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isNewOrder = !selectedOrder?.id;

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Edição em lote
  // pendingStatusChanges: { [orderId]: newStatus }
  const [pendingStatusChanges, setPendingStatusChanges] = useState<Record<string, string>>({});
  const [batchUpdating, setBatchUpdating] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) return;

    // garante que a lista foi carregada e abre os detalhes
    (async () => {
      try {
        if (!orders.length) {
          await fetchOrders();
        }
        // abre os detalhes usando a API já existente
        await viewDetails({ id: openId } as any);
      } catch (e) {
        // silenciosamente ignora
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) return;

    (async () => {
      try {
        if (!orders.length) await fetchOrders();
        await viewDetails({ id: openId } as any);

        // remove ?open=... da URL sem recarregar
        const url = new URL(window.location.href);
        url.searchParams.delete('open');
        window.history.replaceState({}, '', url.toString());
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (res.ok) {
        const response = await res.json();
        setOrders(response.data || []);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      toast.error('Erro ao carregar pedidos');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Status inline agora NÃO faz PUT imediato; apenas marca alteração pendente
  const handleStatusChangeInline = (orderId: string, newStatus: string) => {
    setPendingStatusChanges((prev) => {
      const updated = { ...prev, [orderId]: newStatus };
      return updated;
    });

    // Atualiza visualmente na lista para feedback instantâneo
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    // Se o Dialog está aberto para esse pedido, sincroniza também
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
  };

  // Aplicar alterações em lote (PUT para cada pedido alterado)
  const applyBatchStatusUpdates = async () => {
    const entries = Object.entries(pendingStatusChanges);
    if (entries.length === 0) return;

    setBatchUpdating(true);
    try {
      const results = await Promise.allSettled(
        entries.map(([orderId, status]) =>
          fetch(`/api/orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          }).then(async (res) => {
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              throw new Error(j?.error || `Erro ${res.status}`);
            }
            return res.json();
          })
        )
      );

      // Contabiliza sucessos/erros
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failures = results
        .map((r, idx) => (r.status === 'rejected' ? { orderId: entries[idx][0], error: (r.reason as Error)?.message } : null))
        .filter(Boolean) as { orderId: string; error: string }[];

      if (successCount > 0) {
        toast.success(`${successCount} ${successCount === 1 ? 'pedido atualizado' : 'pedidos atualizados'} com sucesso`);
      }
      if (failures.length > 0) {
        // Mostra erros resumidos
        failures.slice(0, 3).forEach(f => toast.error(`Falha ao atualizar pedido ${f.orderId.substring(0, 8).toUpperCase()}: ${f.error}`));
        if (failures.length > 3) {
          toast.error(`+${failures.length - 3} falhas adicionais`);
        }
      }

      // Refetch para garantir consistência
      await fetchOrders();
      setPendingStatusChanges({});
    } catch (e) {
      toast.error('Erro ao aplicar alterações');
    } finally {
      setBatchUpdating(false);
    }
  };

  const discardBatchChanges = () => {
    if (Object.keys(pendingStatusChanges).length === 0) return;
    // Recarrega da fonte para desfazer alterações visuais
    fetchOrders();
    setPendingStatusChanges({});
  };

  const viewDetails = async (order: Order) => {
    if (order.id) {
      try {
        const res = await fetch(`/api/orders/${order.id}`);
        if (res.ok) {
          const response = await res.json();
          setSelectedOrder(response.data);
          setDetailsOpen(true);
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err?.error || 'Erro ao carregar detalhes');
        }
      } catch (error) {
        toast.error('Erro ao carregar detalhes');
      }
    } else {
      setSelectedOrder(order);
      setDetailsOpen(true);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === status);
    return (
      <Badge className={statusOption?.color || 'bg-gray-100 text-gray-800'}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch =
        (order.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customer_email || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  // POST novo pedido (mantém igual)
  const handleSaveNewOrder = async () => {
    if (!selectedOrder) return;

    if (!selectedOrder.customer_name || !selectedOrder.customer_email) {
      toast.error('Preencha nome e e-mail do cliente.');
      return;
    }
    if (!selectedOrder.delivery_type || !selectedOrder.payment_method) {
      toast.error('Preencha tipo de entrega e método de pagamento.');
      return;
    }

    setSaving(true);
    try {
      const delivery_address =
        selectedOrder.delivery_type === 'DELIVERY'
          ? {
              street: selectedOrder.address,
              city: selectedOrder.city,
              state: selectedOrder.state,
              zip_code: selectedOrder.zip_code,
            }
          : null;

      const itemsPayload =
        (selectedOrder.items || []).map((i) => ({
          product_id: (i as any).product_id,
          variant_id: (i as any).variant_id || null,
          quantity: i.quantity,
        })) || [];

      const body = {
        customer_name: selectedOrder.customer_name,
        customer_email: selectedOrder.customer_email,
        customer_phone: selectedOrder.customer_phone,
        delivery_address,
        delivery_type: selectedOrder.delivery_type,
        payment_method: selectedOrder.payment_method,
        notes: selectedOrder.notes ?? null,
        status: selectedOrder.status || 'RECEBIDO',
        items: itemsPayload,
        ...(selectedOrder.company_id ? { company_id: selectedOrder.company_id } : {}),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || 'Erro ao salvar pedido');
        return;
      }

      toast.success('Pedido criado com sucesso!');
      setDetailsOpen(false);
      setSelectedOrder(null);
      await fetchOrders();
    } catch (e) {
      toast.error('Erro ao salvar pedido');
    } finally {
      setSaving(false);
    }
  };

  // PUT pedido existente via Dialog (mantém igual)
  const handleUpdateOrder = async () => {
    if (!selectedOrder?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedOrder.status,
          notes: selectedOrder.notes ?? undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || 'Erro ao atualizar pedido');
        return;
      }

      if (json?.data) {
        setSelectedOrder(json.data);
      }

      toast.success('Pedido atualizado com sucesso!');
      setDetailsOpen(false);
      await fetchOrders();
      setPendingStatusChanges((prev) => {
        if (selectedOrder.id && prev[selectedOrder.id]) {
          const { [selectedOrder.id]: _, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    } catch (e) {
      toast.error('Erro ao atualizar pedido');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  const pendingCount = Object.keys(pendingStatusChanges).length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Gestão de Pedidos</CardTitle>
          <CardDescription>Visualize e gerencie todos os pedidos da sua distribuidora</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, cliente ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {STATUS_OPTIONS.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500">
                      Nenhum pedido encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">#{order.order_number}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{order.customer_name}</span>
                          <span className="text-xs text-gray-500">{order.customer_email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{DELIVERY_TYPES[order.delivery_type] || order.delivery_type}</TableCell>
                      <TableCell>{PAYMENT_METHODS[order.payment_method] || order.payment_method}</TableCell>
                      <TableCell>R$ {order.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <Select
                          value={order.status}
                          onValueChange={(value) => handleStatusChangeInline(order.id!, value)}
                          disabled={batchUpdating}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(status => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {order.created_at ? new Date(order.created_at).toLocaleDateString('pt-BR') : '--'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewDetails(order)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-2"
                          onClick={() => order.id && window.open(`/print/pedidos/${order.id}`, '_blank')}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Rodapé de alterações pendentes */}
          {pendingCount > 0 && (
            <div className="mt-4 flex items-center justify-between rounded-md border p-3 bg-muted/40">
              <div className="text-sm">
                {pendingCount} {pendingCount === 1 ? 'alteração pendente' : 'alterações pendentes'}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={discardBatchChanges} disabled={batchUpdating}>
                  Descartar
                </Button>
                <Button onClick={applyBatchStatusUpdates} disabled={batchUpdating}>
                  {batchUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Atualizar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isNewOrder ? 'Novo Pedido' : `Detalhes do Pedido #${selectedOrder?.order_number}`}
            </DialogTitle>
            {!isNewOrder && selectedOrder?.created_at && (
              <DialogDescription>
                Realizado em {new Date(selectedOrder.created_at).toLocaleString('pt-BR')}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Informações do Cliente */}
              <div>
                <h3 className="font-semibold mb-2">Cliente</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Nome:</span> {selectedOrder.customer_name || '-'}
                  </div>
                  <div>
                    <span className="text-gray-600">E-mail:</span> {selectedOrder.customer_email || '-'}
                  </div>
                  {selectedOrder.customer_phone && (
                    <div>
                      <span className="text-gray-600">Telefone:</span> {selectedOrder.customer_phone}
                    </div>
                  )}
                </div>
              </div>

              {/* Informações de Entrega */}
              {selectedOrder.delivery_type === 'DELIVERY' && (
                <div>
                  <h3 className="font-semibold mb-2">Endereço de Entrega</h3>
                  <div className="text-sm">
                    {selectedOrder.address && <div>{selectedOrder.address}</div>}
                    {selectedOrder.city && selectedOrder.state && (
                      <div>{selectedOrder.city} - {selectedOrder.state}</div>
                    )}
                    {selectedOrder.zip_code && <div>CEP: {selectedOrder.zip_code}</div>}
                  </div>
                </div>
              )}

              {/* Itens do Pedido */}
              {!!selectedOrder.items?.length && (
                <div>
                  <h3 className="font-semibold mb-2">Itens do Pedido</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Preço Unit.</TableHead>
                        <TableHead>Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.product_name}
                            {item.variant_name && (
                              <span className="text-sm text-gray-500"> ({item.variant_name})</span>
                            )}
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>R$ {item.unit_price.toFixed(2)}</TableCell>
                          <TableCell>R$ {item.subtotal.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totais */}
              {!isNewOrder && (
                <div className="border-t pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Subtotal:</span>
                    <span>R$ {selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Taxa de Entrega:</span>
                    <span>R$ {selectedOrder.delivery_fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total:</span>
                    <span>R$ {selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Observações */}
              {selectedOrder.notes !== undefined && selectedOrder.notes !== null && (
                <div>
                  <h3 className="font-semibold mb-2">Observações</h3>
                  <p className="text-sm text-gray-600">{selectedOrder.notes || '-'}</p>
                </div>
              )}

              {/* Status - único campo editável no Dialog */}
              <div>
                <h3 className="font-semibold mb-2">Status do Pedido</h3>
                <Select
                  value={selectedOrder.status}
                  onValueChange={(value) => setSelectedOrder({ ...selectedOrder, status: value })}
                  disabled={saving || batchUpdating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Footer: Botões */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDetailsOpen(false)} disabled={saving || batchUpdating}>
                  Cancelar
                </Button>
                <Button
                  onClick={isNewOrder ? handleSaveNewOrder : handleUpdateOrder}
                  disabled={saving || batchUpdating}
                >
                  {(saving || batchUpdating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isNewOrder ? 'Salvar' : 'Atualizar'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => selectedOrder?.id && window.open(`/print/pedidos/${selectedOrder.id}`, '_blank')}
                  disabled={saving || batchUpdating}
                >
                  Imprimir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}