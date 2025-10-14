'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AuditLogsList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs de Auditoria</CardTitle>
        <CardDescription>Histórico de ações no sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium mb-2">Componente em desenvolvimento</p>
          <p className="text-sm">Os logs de auditoria serão exibidos em breve.</p>
        </div>
      </CardContent>
    </Card>
  );
}
