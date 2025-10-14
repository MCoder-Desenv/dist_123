import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth';
import { LoginForm } from '@/components/auth/login-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Login - Sistema Distribuidora',
  description: 'Faça login no sistema de distribuidora de bebidas',
};

export default async function LoginPage() {
  const session = await getServerAuthSession();

  if (session) {
    const role = session.user?.role;

    // Se for ADMINISTRADOR, vai direto para /admin/empresas
    if (role === 'ADMINISTRADOR') {
      redirect('/admin/empresas');
    }

    // Para outros perfis, redireciona para /admin
    redirect('/admin');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sistema Distribuidora
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Entre na sua conta para acessar o sistema
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}