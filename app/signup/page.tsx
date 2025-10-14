
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth';
import { SignupForm } from '@/components/auth/signup-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Criar Conta - Sistema Distribuidora',
  description: 'Crie sua conta e empresa no sistema de distribuidora de bebidas',
};

export default async function SignupPage() {
  const session = await getServerAuthSession();

  if (session) {
    redirect('/admin');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Criar Conta
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Crie sua conta e comece a usar o sistema
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
