
import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getServerAuthSession();

  if (session) {
    // Redirecionar baseado no role do usuário
    if (session.user.role === 'ADMINISTRADOR') {
      redirect('/admin/empresas');
    } else {
      redirect('/admin');
    }
  } else {
    redirect('/login');
  }
}
