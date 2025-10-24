'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Filter,
  Pencil,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface FinancialEntry {
  id: string;
  type: 'RECEITA' | 'DESPESA';
  amount: number;
  description: string;
  category: string | null;
  payment_method: string | null;
  due_date: string | null;
  paid_date: string | null;
  status: 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
  created_at: string;
  order?: {
    id: string;
    customer_name: string;
    status: string;
  } | null;
}

interface FinancialSummary {
  receita: {
    total: number;
    pago: number;
    pendente: number;
  };
  despesa: {
    total: number;
    pago: number;
    pendente: number;
  };
  saldo: number;
}

export function FinancialManagement(): JSX.Element {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);

  const [formData, setFormData] = useState({
    type: 'RECEITA',
    amount: '',
    description: '',
    category: '',
    payment_method: '',
    due_date: '',
    paid_date: '',
    status: 'PENDENTE',
  });

  // ConfirmationDialog global state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'confirmation' | 'alert' | 'error'>('confirmation');
  const [dialogTitle, setDialogTitle] = useState<string>('');
  const [dialogDescription, setDialogDescription] = useState<string | React.ReactNode | undefined>(undefined);
  const [dialogButtons, setDialogButtons] = useState<
    { label: string; onClick: () => void; variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost' | 'link' }[]
  >([]);

  // Delete target
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description?: string } | null>(null);

  useEffect(() => {
    fetchFinancialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterStatus]);

  const showDialog = (
    type: 'confirmation' | 'alert' | 'error',
    title: string,
    description?: string | React.ReactNode,
    buttons?: { label: string; onClick: () => void; variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost' | 'link' }[]
  ) => {
    setDialogType(type);
    setDialogTitle(title);
    setDialogDescription(description);
    setDialogButtons(buttons && buttons.length > 0 ? buttons.slice(0, 3) : [{ label: 'OK', onClick: () => {}, variant: 'default' }]);
    setDialogOpen(true);
  };

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('type', filterType);
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const response = await fetch(`/api/financial?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        console.error('Erro ao buscar dados financeiros:', payload);
        setEntries([]);
        setSummary(null);
        showDialog('error', 'Erro ao buscar dados', payload?.message || 'Ocorreu um erro ao carregar dados financeiros.');
        return;
      }

      const entriesData: FinancialEntry[] = payload.data || [];

      const s = payload.summary || {};
      const mappedSummary: FinancialSummary = {
        receita: {
          total: Number(s.total_receitas || 0),
          pago: Number(s.receitas_pagas || 0),
          pendente: Number(s.receitas_pendentes || 0),
        },
        despesa: {
          total: Number(s.total_despesas || 0),
          pago: Number(s.despesas_pagas || 0),
          pendente: Number(s.despesas_pendentes || 0),
        },
        saldo: Number(s.saldo_total || 0),
      };

      setEntries(entriesData);
      setSummary(mappedSummary);
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error);
      setEntries([]);
      setSummary(null);
      showDialog('error', 'Erro ao carregar dados', 'Ocorreu um erro ao carregar dados financeiros.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        console.error('Erro ao criar lançamento:', payload);
        toast.error(payload?.message || 'Erro ao criar lançamento');
        showDialog('error', 'Erro ao criar lançamento', payload?.message || 'Erro ao criar lançamento.');
        return;
      }

      toast.success(payload?.message || 'Lançamento criado com sucesso!');
      showDialog('confirmation', 'Lançamento criado', payload?.message || 'Lançamento criado com sucesso!', [
        { label: 'OK', onClick: () => {}, variant: 'default' },
      ]);

      setIsAddDialogOpen(false);
      setFormData({
        type: 'RECEITA',
        amount: '',
        description: '',
        category: '',
        payment_method: '',
        due_date: '',
        paid_date: '',
        status: 'PENDENTE',
      });
      fetchFinancialData();
    } catch (error) {
      console.error('Erro ao adicionar lançamento:', error);
      toast.error('Erro ao adicionar lançamento');
      showDialog('error', 'Erro ao adicionar lançamento', 'Ocorreu um erro ao adicionar lançamento.');
    }
  };

  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    try {
      const response = await fetch(`/api/financial/${editingEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        console.error('Erro ao atualizar lançamento:', payload);
        toast.error(payload?.message || 'Erro ao atualizar lançamento');
        showDialog('error', 'Erro ao atualizar lançamento', payload?.message || 'Erro ao atualizar lançamento.');
        return;
      }

      toast.success(payload?.message || 'Lançamento atualizado com sucesso!');
      showDialog('confirmation', 'Lançamento atualizado', payload?.message || 'Lançamento atualizado com sucesso!', [
        { label: 'OK', onClick: () => {}, variant: 'default' },
      ]);

      setIsEditDialogOpen(false);
      setEditingEntry(null);
      fetchFinancialData();
    } catch (error) {
      console.error('Erro ao atualizar lançamento:', error);
      toast.error('Erro ao atualizar lançamento');
      showDialog('error', 'Erro ao atualizar lançamento', 'Ocorreu um erro ao atualizar o lançamento.');
    }
  };

  const openDeleteDialog = (entry: FinancialEntry) => {
    setDeleteTarget({ id: entry.id, description: entry.description });
    showDialog('confirmation', 'Confirmar exclusão', `Tem certeza que deseja excluir: "${entry.description}"?`, [
      { label: 'Cancelar', onClick: () => {}, variant: 'default' },
      { label: 'Excluir', onClick: () => handleDeleteEntryConfirmed(entry.id), variant: 'destructive' },
    ]);
  };

  const handleDeleteEntryConfirmed = async (id: string) => {
    try {
      const response = await fetch(`/api/financial/${id}`, {
        method: 'DELETE',
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        console.error('Erro ao excluir lançamento:', payload);
        toast.error(payload?.message || 'Erro ao excluir lançamento');
        showDialog('error', 'Erro ao excluir lançamento', payload?.message || 'Erro ao excluir lançamento.');
        return;
      }

      toast.success(payload?.message || 'Lançamento excluído com sucesso!');
      showDialog('confirmation', 'Lançamento excluído', payload?.message || 'Lançamento excluído com sucesso!', [
        { label: 'OK', onClick: () => {}, variant: 'default' },
      ]);
      fetchFinancialData();
    } catch (error) {
      console.error('Erro ao excluir lançamento:', error);
      toast.error('Erro ao excluir lançamento');
      showDialog('error', 'Erro ao excluir lançamento', 'Ocorreu um erro ao excluir o lançamento.');
    } finally {
      setDeleteTarget(null);
    }
  };

  const openEditDialog = (entry: FinancialEntry) => {
    setEditingEntry(entry);
    setFormData({
      type: entry.type,
      amount: entry.amount.toString(),
      description: entry.description,
      category: entry.category || '',
      payment_method: entry.payment_method || '',
      due_date: entry.due_date ? entry.due_date.split('T')[0] : '',
      paid_date: entry.paid_date ? entry.paid_date.split('T')[0] : '',
      status: entry.status,
    });
    setIsEditDialogOpen(true);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      value
    );

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      'default' | 'secondary' | 'destructive' | 'outline'
    > = {
      PENDENTE: 'secondary',
      PAGO: 'default',
      VENCIDO: 'destructive',
      CANCELADO: 'outline',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total em Caixa</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-700" />
          </CardHeader>
          <CardContent>
            {(() => {
              const totalEmCaixa =
                (summary?.receita?.pago || 0) - (summary?.despesa?.pago || 0);
              const positive = totalEmCaixa >= 0;
              return (
                <>
                  <div className={`text-2xl font-bold ${positive ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totalEmCaixa)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Receitas pagas {positive ? '−' : '−'} Despesas pagas
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Despesas (Pagas)</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary?.despesa?.pago || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de despesas com status PAGO
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Despesas (Pendentes)</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(summary?.despesa?.pendente || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de despesas pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receitas (Pagas)</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.receita?.pago || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de receitas com status PAGO
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receitas (Pendentes)</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(summary?.receita?.pendente || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total de receitas pendentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Ações */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Gestão Financeira</CardTitle>
              <CardDescription>
                Controle de contas a receber e fluxo de caixa
              </CardDescription>
            </div>

            {/* Botão Novo Lançamento */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Lançamento
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Novo Lançamento Financeiro</DialogTitle>
                  <DialogDescription>
                    Adicione uma nova receita ou despesa ao sistema
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleAddEntry} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value) =>
                          setFormData({ ...formData, type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RECEITA">Receita</SelectItem>
                          <SelectItem value="DESPESA">Despesa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Valor *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        required
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label>Descrição *</Label>
                      <Input
                        required
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Input
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value })
                        }
                        placeholder="Ex: Vendas, Fornecedores, Aluguel"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Método de Pagamento</Label>
                      <Select
                        value={formData.payment_method}
                        onValueChange={(value) =>
                          setFormData({ ...formData, payment_method: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PIX">PIX</SelectItem>
                          <SelectItem value="CARTAO_ENTREGA">Cartão</SelectItem>
                          <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                          <SelectItem value="BOLETO">Boleto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Data de Vencimento</Label>
                      <Input
                        type="date"
                        value={formData.due_date}
                        onChange={(e) =>
                          setFormData({ ...formData, due_date: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Data de Pagamento</Label>
                      <Input
                        type="date"
                        value={formData.paid_date}
                        onChange={(e) =>
                          setFormData({ ...formData, paid_date: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label>Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) =>
                          setFormData({ ...formData, status: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDENTE">Pendente</SelectItem>
                          <SelectItem value="PAGO">Pago</SelectItem>
                          <SelectItem value="VENCIDO">Vencido</SelectItem>
                          <SelectItem value="CANCELADO">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit">Adicionar</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filtros */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Label>Tipo:</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="RECEITA">Receitas</SelectItem>
                  <SelectItem value="DESPESA">Despesas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label>Status:</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="PAGO">Pago</SelectItem>
                  <SelectItem value="VENCIDO">Vencido</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhum lançamento encontrado. Adicione o primeiro!
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {format(new Date(entry.created_at), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })}
                      </TableCell>

                      <TableCell>
                        <Badge variant={entry.type === 'RECEITA' ? 'default' : 'secondary'}>
                          {entry.type}
                        </Badge>
                      </TableCell>

                      <TableCell>{entry.description}</TableCell>
                      <TableCell>{entry.category || '-'}</TableCell>

                      <TableCell
                        className={entry.type === 'RECEITA' ? 'text-green-600' : 'text-red-600'}
                      >
                        {formatCurrency(entry.amount)}
                      </TableCell>

                      <TableCell>{getStatusBadge(entry.status)}</TableCell>

                      <TableCell>
                        {entry.due_date
                          ? format(new Date(entry.due_date), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(entry)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" disabled={!!entry.order?.id} onClick={() => openDeleteDialog(entry)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Lançamento</DialogTitle>
            <DialogDescription>Atualize as informações do lançamento</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateEntry} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="PAGO">Pago</SelectItem>
                    <SelectItem value="VENCIDO">Vencido</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Descrição *</Label>
                <Input
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Data de Pagamento</Label>
                <Input
                  type="date"
                  value={formData.paid_date}
                  onChange={(e) => setFormData({ ...formData, paid_date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Alterações</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Global ConfirmationDialog */}
      <ConfirmationDialog
        open={dialogOpen}
        onOpenChange={(open) => setDialogOpen(open)}
        type={dialogType}
        title={dialogTitle}
        description={dialogDescription}
        buttons={dialogButtons}
      />
    </div>
  );
}