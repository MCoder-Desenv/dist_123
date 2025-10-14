// src/components/reports/pdf-exporter.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Augment do tipo para acessar doc.lastAutoTable sem usar "any"
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: { finalY: number; [key: string]: any };
  }
}

type SalesReport = {
  resumo: { totalVendas: number; totalPedidos: number; ticketMedio: number };
  vendasPorDia: Record<string, number>;
  produtosMaisVendidos: Array<{ id: string; name: string; quantity: number; revenue: number }>;
  vendasPorCategoria: Array<{ name: string; revenue: number; quantity: number }>;
  metodosPagamento: Record<string, number>;
  tiposEntrega: Record<string, number>;
  orders: any[];
};

type ProductReport = {
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
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const addHeader = (doc: jsPDF, title: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, y, { align: 'center' });
  return y + 8;
};

export async function exportSalesPdf(salesReport: SalesReport) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const marginLeft = 14;
  const marginRight = 14;

  let y = addHeader(doc, 'Relatório de Vendas');

  // Resumo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Resumo', marginLeft, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Total em Vendas: ${formatCurrency(salesReport.resumo.totalVendas)}`, marginLeft, y);
  y += 6;
  doc.text(`Total de Pedidos: ${salesReport.resumo.totalPedidos}`, marginLeft, y);
  y += 6;
  doc.text(`Ticket Médio: ${formatCurrency(salesReport.resumo.ticketMedio)}`, marginLeft, y);
  y += 10;

  // Métodos de Pagamento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Métodos de Pagamento', marginLeft, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  Object.entries(salesReport.metodosPagamento).forEach(([method, count]) => {
    doc.text(`${method}: ${count} ${count === 1 ? 'pedido' : 'pedidos'}`, marginLeft, y);
    y += 5;
  });
  y += 6;

  // Tipos de Entrega
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Tipos de Entrega', marginLeft, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  Object.entries(salesReport.tiposEntrega).forEach(([type, count]) => {
    doc.text(`${type}: ${count} ${count === 1 ? 'pedido' : 'pedidos'}`, marginLeft, y);
    y += 5;
  });
  y += 8;

  // Produtos Mais Vendidos
  autoTable(doc, {
    startY: y,
    head: [['Produto', 'Qtd Vendida', 'Receita Total']],
    body: salesReport.produtosMaisVendidos.map((p) => [
      p.name,
      String(p.quantity),
      formatCurrency(p.revenue),
    ]),
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [33, 150, 243], textColor: 255, halign: 'center' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', textColor: [34, 197, 94] } },
    margin: { left: marginLeft, right: marginRight },
    theme: 'striped',
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // Vendas por Categoria
  autoTable(doc, {
    startY: y,
    head: [['Categoria', 'Quantidade', 'Receita']],
    body: salesReport.vendasPorCategoria.map((c) => [
      c.name,
      String(c.quantity),
      formatCurrency(c.revenue),
    ]),
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [76, 175, 80], textColor: 255, halign: 'center' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', textColor: [34, 197, 94] } },
    margin: { left: marginLeft, right: marginRight },
    theme: 'striped',
  });

  doc.save(`relatorio_vendas_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportProductsPdf(productReport: ProductReport) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const marginLeft = 14;
  const marginRight = 14;

  let y = addHeader(doc, 'Relatório de Produtos');

  // Resumo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Resumo', marginLeft, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Total de Produtos: ${productReport.total_products}`, marginLeft, y);
  y += 6;
  doc.text(`Produtos Ativos: ${productReport.active_products}`, marginLeft, y);
  y += 10;

  // Tabela de Produtos
  autoTable(doc, {
    startY: y,
    head: [
      ['Produto', 'Categoria', 'SKU', 'Preço Base', 'Variantes', 'Total Vendido', 'Receita Total', 'Status'],
    ],
    body: productReport.products.map((p) => [
      p.name,
      p.category,
      p.sku || '-',
      formatCurrency(p.base_price),
      String(p.variants_count),
      String(p.total_vendido),
      formatCurrency(p.receita_total),
      p.active ? 'Ativo' : 'Inativo',
    ]),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [96, 125, 139], textColor: 255, halign: 'center' },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', textColor: [34, 197, 94] },
    },
    margin: { left: marginLeft, right: marginRight },
    theme: 'striped',
  });

  doc.save(`relatorio_produtos_${new Date().toISOString().slice(0, 10)}.pdf`);
}