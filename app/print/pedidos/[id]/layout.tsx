// app/admin/pedidos/[id]/imprimir/layout.tsx
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Impressão</title>
      </head>
      <body>{children}</body>
    </html>
  );
}
