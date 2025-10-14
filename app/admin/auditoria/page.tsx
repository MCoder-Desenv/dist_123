
import { Metadata } from 'next';
import { getServerAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AuditLogsList } from '@/components/admin/audit-logs-list';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Logs de Auditoria - Sistema Distribuidora',
  description: 'Visualização de logs de auditoria do sistema',
};

export default async function AuditoriaPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  // Apenas administrador, sub_master e master_dist podem acessar
  if (!['ADMINISTRADOR', 'SUB_MASTER', 'MASTER_DIST'].includes(session.user.role)) {
    redirect('/admin');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Logs de Auditoria
        </h1>
        <p className="mt-2 text-gray-600">
          Visualize todas as ações realizadas no sistema
        </p>
      </div>

      <AuditLogsList />
    </div>
  );
}
