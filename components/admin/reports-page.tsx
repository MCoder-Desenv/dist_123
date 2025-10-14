'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Download,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// IMPORTA O NOVO EXPORTADOR DE PDF
import { exportSalesPdf, exportProductsPdf } from '@/components/admin/reports/pdf-exporter';

interface SalesReport {
  resumo: {
    totalVendas: number;
    totalPedidos: number;
    ticketMedio: number;
  };
  vendasPorDia: Record<string, number>;
  produtosMaisVendidos: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  vendasPorCategoria: Array<{
    name: string;
    revenue: number;
    quantity: number;
  }>;
  metodosPagamento: Record<string, number>;
  tiposEntrega: Record<string, number>;
  orders: any[];
}

interface ProductReport {
  products: Array<{
    id: string;
    name: string;
    category: string;
    sku: string | null;
    base_price: number;
    active: boolean;
    variants_count: number;
    total_vendido: number;
    receita_total: number;
  }>;
  total_products: number;
  active_products: number;
}

export function ReportsPage() {
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [productReport, setProductReport] = useState<ProductReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTab, setActiveTab] = useState('sales');
  const [hasFiltered, setHasFiltered] = useState(false);

  // Fetchers
  const fetchSalesReport = async (options?: { startDate?: string; endDate?: string }) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const s = options?.startDate ?? startDate;
      const e = options?.endDate ?? endDate;
      if (s) params.append('startDate', s);
      if (e) params.append('endDate', e);

      const url = `/api/reports/sales${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Erro ao buscar relatório');

      const data = await response.json();
      setSalesReport(data);
      setHasFiltered(true);
    } catch (error) {
      console.error('Erro ao carregar relatório de vendas:', error);
      setSalesReport(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductReport = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reports/products');
      if (!response.ok) throw new Error('Erro ao buscar relatório');

      const data = await response.json();
      setProductReport(data);
      setHasFiltered(true);
    } catch (error) {
      console.error('Erro ao carregar relatório de produtos:', error);
      setProductReport(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((header) => JSON.stringify(row[header] || '')).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportSalesReport = () => {
    if (!salesReport) return;

    const data = salesReport.orders.map((order: any) => ({
      Data: format(new Date(order.created_at), 'dd/MM/yyyy HH:mm'),
      Cliente: order.customer_name,
      Email: order.customer_email,
      Telefone: order.customer_phone,
      'Tipo Entrega': order.delivery_type,
      'Método Pagamento': order.payment_method,
      Subtotal: order.subtotal,
      'Taxa Entrega': order.delivery_fee,
      'Total': order.total_amount,
      Status: order.status,
    }));

    exportToCSV(data, 'relatorio_vendas');
  };

  const exportProductReport = () => {
    if (!productReport) return;

    const data = productReport.products.map((product) => ({
      Nome: product.name,
      Categoria: product.category,
      SKU: product.sku || '-',
      'Preço Base': product.base_price,
      Ativo: product.active ? 'Sim' : 'Não',
      'Variantes': product.variants_count,
      'Total Vendido': product.total_vendido,
      'Receita Total': product.receita_total,
    }));

    exportToCSV(data, 'relatorio_produtos');
  };

  // Handlers do filtro
  const handleFilter = () => {
    if (!startDate && !endDate) {
      alert('Por favor, selecione pelo menos uma data.');
      return;
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      alert('A data inicial não pode ser maior que a data final.');
      return;
    }
    if (activeTab === 'sales') fetchSalesReport({ startDate, endDate });
    else if (activeTab === 'products') fetchProductReport();
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSalesReport(null);
    setProductReport(null);
    setHasFiltered(false);
  };

  const isFilterDisabled = () => {
    if (!startDate && !endDate) return true;
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Filtros de Data */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Selecione o período para os relatórios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClearFilters}>
                Limpar Filtros
              </Button>
              <Button onClick={handleFilter} disabled={isFilterDisabled()}>
                Filtrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Relatórios */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="sales">Vendas</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
        </TabsList>

        {/* Relatório de Vendas */}
        <TabsContent value="sales" className="space-y-6">
          <div>
            {loading ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">Carregando...</CardContent>
              </Card>
            ) : salesReport ? (
              <>
                {/* Cards de Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total em Vendas</CardTitle>
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(salesReport.resumo.totalVendas)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {salesReport.resumo.totalPedidos} pedidos
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {salesReport.resumo.totalPedidos}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Pedidos realizados</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-600">
                        {formatCurrency(salesReport.resumo.ticketMedio)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Por pedido</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Produtos Mais Vendidos */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Produtos Mais Vendidos</CardTitle>
                      <CardDescription>Top 10 produtos por quantidade</CardDescription>
                    </div>
                    <Package className="h-5 w-5 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right">Quantidade Vendida</TableHead>
                            <TableHead className="text-right">Receita Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salesReport.produtosMaisVendidos.map((product) => (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell className="text-right">{product.quantity}</TableCell>
                              <TableCell className="text-right text-green-600">
                                {formatCurrency(product.revenue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Vendas por Categoria */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Vendas por Categoria</CardTitle>
                      <CardDescription>Desempenho das categorias</CardDescription>
                    </div>
                    <BarChart3 className="h-5 w-5 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Quantidade</TableHead>
                            <TableHead className="text-right">Receita</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salesReport.vendasPorCategoria.map((cat, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{cat.name}</TableCell>
                              <TableCell className="text-right">{cat.quantity}</TableCell>
                              <TableCell className="text-right text-green-600">
                                {formatCurrency(cat.revenue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Métodos de Pagamento e Tipos de Entrega */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Métodos de Pagamento</CardTitle>
                      <CardDescription>Distribuição por forma de pagamento</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(salesReport.metodosPagamento).map(([method, count]) => (
                          <div key={method} className="flex justify-between items-center">
                            <span className="text-sm font-medium">{method}</span>
                            <Badge>{count} pedidos</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Tipos de Entrega</CardTitle>
                      <CardDescription>Distribuição por tipo de entrega</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(salesReport.tiposEntrega).map(([type, count]) => (
                          <div key={type} className="flex justify-between items-center">
                            <span className="text-sm font-medium">{type}</span>
                            <Badge>{count} pedidos</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : hasFiltered ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  Nenhum dado disponível para o período selecionado
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  Selecione um período e clique em "Filtrar" para visualizar os dados
                </CardContent>
              </Card>
            )}
          </div>

          {/* Botões de Exportação (CSV + PDF) */}
          {salesReport && (
            <div className="flex justify-end gap-2">
              <Button onClick={exportSalesReport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Relatório de Vendas (CSV)
              </Button>
              <Button onClick={() => exportSalesPdf(salesReport)}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Relatório de Vendas (PDF)
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Relatório de Produtos */}
        <TabsContent value="products" className="space-y-6">
          <div>
            {loading ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">Carregando...</CardContent>
              </Card>
            ) : productReport ? (
              <>
                {/* Cards de Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
                      <Package className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {productReport.total_products}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Produtos cadastrados</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Produtos Ativos</CardTitle>
                      <Package className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {productReport.active_products}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Disponíveis para venda</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabela de Produtos */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Desempenho dos Produtos</CardTitle>
                      <CardDescription>Análise completa de todos os produtos</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-right">Preço Base</TableHead>
                            <TableHead className="text-right">Variantes</TableHead>
                            <TableHead className="text-right">Total Vendido</TableHead>
                            <TableHead className="text-right">Receita Total</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productReport.products.map((product) => (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell>{product.category}</TableCell>
                              <TableCell>{product.sku || '-'}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(product.base_price)}
                              </TableCell>
                              <TableCell className="text-right">{product.variants_count}</TableCell>
                              <TableCell className="text-right">{product.total_vendido}</TableCell>
                              <TableCell className="text-right text-green-600">
                                {formatCurrency(product.receita_total)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={product.active ? 'default' : 'secondary'}>
                                  {product.active ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : hasFiltered ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  Nenhum dado disponível
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  Clique em "Filtrar" para visualizar os dados dos produtos
                </CardContent>
              </Card>
            )}
          </div>

          {/* Botões de Exportação (CSV + PDF) */}
          {productReport && (
            <div className="flex justify-end gap-2">
              <Button onClick={exportProductReport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Relatório de Produtos (CSV)
              </Button>
              <Button onClick={() => exportProductsPdf(productReport)}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Relatório de Produtos (PDF)
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}