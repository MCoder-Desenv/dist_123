
import { Metadata } from 'next';
import { getServerAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserManagement } from '@/components/admin/user-management';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Usuários - Sistema Distribuidora',
  description: 'Gestão de usuários do sistema',
};

export default async function UsuariosPage() {
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
          Gestão de Usuários
        </h1>
        <p className="mt-2 text-gray-600">
          Gerencie os usuários e permissões do sistema
        </p>
      </div>

      <UserManagement />
    </div>
  );
}
