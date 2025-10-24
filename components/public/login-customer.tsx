// src/components/public/login-customer.tsx
'use client';

import React, { startTransition, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Eye, EyeOff } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  logo_url?: string;
  slug?: string;
}

type DialogButton = {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'destructive';
};

// Função para aplicar máscara de CPF/CNPJ
const formatCpfCnpj = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  
  return numbers
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

// Função para remover máscara
const removeMask = (value: string): string => {
  return value.replace(/\D/g, '');
};

export default function LoginCustomer({ slug, company }: { slug: string; company: Company }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') || `/empresa/${slug}`;

  const { setUser } = useAuth();
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Estado para mostrar/ocultar senha
  const [showPassword, setShowPassword] = useState(false);

  // Estados para o ConfirmationDialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'confirmation' | 'alert' | 'error'>('error');
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogDescription, setDialogDescription] = useState('');
  const [dialogButtons, setDialogButtons] = useState<DialogButton[]>([
    { label: 'Fechar', onClick: () => setDialogOpen(false), variant: 'default' },
  ]);

  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpfCnpj(e.target.value);
    setCnpjCpf(formatted);
  };

  const closeDialog = () => {
    setDialogOpen(false);
  };

  // utilitário para navegar e fechar diálogo
  const navigateAndClose = (path: string) => {
    setDialogOpen(false);
    router.push(path);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanCpfCnpj = removeMask(cnpjCpf);
    
    if (!cleanCpfCnpj || !password) {
      setDialogType('alert');
      setDialogTitle('Campos obrigatórios');
      setDialogDescription('Por favor, preencha CPF/CNPJ e senha para continuar.');
      setDialogButtons([{ label: 'Fechar', onClick: closeDialog }]);
      setDialogOpen(true);
      return;
    }

    if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      setDialogType('error');
      setDialogTitle('CPF/CNPJ inválido');
      setDialogDescription('CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos.');
      setDialogButtons([{ label: 'Fechar', onClick: closeDialog }]);
      setDialogOpen(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/customers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj_cpf: cleanCpfCnpj,
          password,
          company_id: company.id,
        }),
      });

      if (res.ok) {
        const customer = await res.json();

        startTransition(() => {
          setUser(customer);
        });

        // Sucesso: mostrar diálogo de confirmação com botão para continuar
        setDialogType('confirmation');
        setDialogTitle('Login realizado!');
        setDialogDescription(`Bem-vindo(a), ${customer.name}!`);
        setDialogButtons([
          {
            label: 'Continuar',
            onClick: () => {
              setDialogOpen(false);
              router.push(redirect);
            },
            variant: 'default',
          },
        ]);
        setDialogOpen(true);

        // Redirecionar automaticamente após 1.5s (comportamento anterior)
        setTimeout(() => {
          router.push(redirect);
        }, 1500);
        return;
      }

      // Erro: tratar respostas do backend para exibir mensagens e botões apropriados
      const err = await res.json().catch(() => ({} as any));
      const message = err?.error || 'Erro ao fazer login.';
      const suggestion = err?.suggestion || null;
      const suggestionUrl = err?.suggestion_url || err?.signup_url || null;

      // Default button: fechar
      let buttons: DialogButton[] = [
        { label: 'Fechar', onClick: closeDialog, variant: 'default' },
      ];

      if (res.status === 404) {
        // CPF/CNPJ não cadastrado: oferecer criar conta
        setDialogType('alert');
        setDialogTitle('CPF/CNPJ não cadastrado');
        setDialogDescription(message + (suggestion ? `\n\n${suggestion}` : ''));

        buttons.unshift({
          label: 'Criar conta',
          onClick: () => navigateAndClose(`/empresa/${slug}/registerCustomer`),
          variant: 'default',
        });
      } else if (res.status === 401) {
        // Senha incorreta -> apenas OK
        setDialogType('error');
        setDialogTitle('Senha incorreta');
        setDialogDescription(
          message + (suggestion ? `\n\n${suggestion}` : '\nSe esqueceu a senha, solicite ajuda à empresa.')
        );

        // Override buttons to a single OK button
        buttons = [{ label: 'OK', onClick: closeDialog, variant: 'default' }];
      } else if (res.status === 403) {
        // Conta desativada
        setDialogType('error');
        setDialogTitle('Conta desativada');
        setDialogDescription(message + (suggestion ? `\n\n${suggestion}` : 'Entre em contato com a empresa para reativação.'));
      } else {
        // Outros erros (400, 500, etc)
        setDialogType('error');
        setDialogTitle('Erro ao fazer login');
        setDialogDescription(message + (suggestion ? `\n\n${suggestion}` : 'Tente novamente mais tarde.'));
      }

      // Se backend forneceu uma URL de sugestão (ex: página de suporte/signup), adiciona botão
      // Não adiciona para o caso 401, pois queremos apenas OK
      if (suggestionUrl && res.status !== 401) {
        buttons.unshift({
          label: 'Abrir link',
          onClick: () => {
            setDialogOpen(false);
            window.open(suggestionUrl, '_blank');
          },
          variant: 'default',
        });
      }

      setDialogButtons(buttons);
      setDialogOpen(true);
    } catch (err) {
      console.error('Login error:', err);

      setDialogType('error');
      setDialogTitle('Erro de conexão');
      setDialogDescription('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
      setDialogButtons([
        { label: 'Fechar', onClick: closeDialog },
        { label: 'Tentar novamente', onClick: () => { setDialogOpen(false); /* usuário pode reenviar */ }, variant: 'outline' },
      ]);
      setDialogOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white shadow rounded p-6">
          {/* Logo da empresa */}
          {company.logo_url && (
            <div className="flex justify-center mb-4">
              <img 
                src={company.logo_url} 
                alt={company.name} 
                className="h-16 object-contain"
              />
            </div>
          )}

          <h2 className="text-xl font-bold mb-4 text-center">Entrar — {company.name}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo CPF/CNPJ */}
            <div>
              <Label htmlFor="cnpj_cpf">CPF/CNPJ</Label>
              <Input
                id="cnpj_cpf"
                type="text"
                value={cnpjCpf}
                onChange={handleCpfCnpjChange}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                maxLength={18}
                required
                disabled={loading}
              />
            </div>

            {/* Campo Senha com botão de mostrar/ocultar */}
            <div>
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  onMouseDown={(e) => e.preventDefault()} // evita perda de foco no input
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>

            <div className="text-sm text-center text-gray-600 mt-2">
              Não tem conta?{' '}
              <a 
                className="text-blue-600 hover:underline" 
                href={`/empresa/${slug}/registerCustomer`}
              >
                Crie uma conta
              </a>
            </div>
          </form>
        </div>
      </div>

      {/* ConfirmationDialog com botões dinâmicos */}
      <ConfirmationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={dialogType}
        title={dialogTitle}
        description={dialogDescription}
        buttons={dialogButtons.map((b) => ({
          label: b.label,
          onClick: () => {
            try {
              b.onClick();
            } catch (err) {
              console.error('dialog button action error', err);
            }
          },
          variant: b.variant || 'default',
        }))}
      />
    </>
  );
}