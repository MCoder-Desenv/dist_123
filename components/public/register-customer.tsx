// src/components/public/register-customer.tsx
'use client';

import React, { useMemo, useState } from 'react';
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

// Máscara CPF/CNPJ
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

const removeMask = (value: string): string => value.replace(/\D/g, '');

export default function RegisterCustomer({ slug, company }: { slug: string; company: Company }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') || `/empresa/${slug}`;

  const { setUser } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    cnpjCpf: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);

  // Estados olho senha
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'confirmation' | 'alert' | 'error'>('confirmation');
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogDescription, setDialogDescription] = useState('');

  const cleanCnpjCpf = useMemo(() => removeMask(formData.cnpjCpf), [formData.cnpjCpf]);
  const isPasswordTooShort = formData.password.length > 0 && formData.password.length < 6;
  const passwordsFilled = formData.password.length > 0 && formData.confirmPassword.length > 0;
  const passwordsMismatch = passwordsFilled && formData.password !== formData.confirmPassword;

  // Desabilitar submit quando inválido
  const isSubmitDisabled =
    loading ||
    !formData.name ||
    !formData.email ||
    !cleanCnpjCpf ||
    !formData.password ||
    !formData.confirmPassword ||
    isPasswordTooShort ||
    passwordsMismatch ||
    (cleanCnpjCpf.length !== 11 && cleanCnpjCpf.length !== 14);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (id === 'cnpjCpf') {
      setFormData((prev) => ({ ...prev, [id]: formatCpfCnpj(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações cliente
    if (!formData.name || !formData.email || !cleanCnpjCpf || !formData.password || !formData.confirmPassword) {
      setDialogType('alert');
      setDialogTitle('Campos obrigatórios');
      setDialogDescription('Preencha todos os campos obrigatórios para continuar.');
      setDialogOpen(true);
      return;
    }

    if (cleanCnpjCpf.length !== 11 && cleanCnpjCpf.length !== 14) {
      setDialogType('error');
      setDialogTitle('CPF/CNPJ inválido');
      setDialogDescription('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      setDialogOpen(true);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setDialogType('error');
      setDialogTitle('Senhas não coincidem');
      setDialogDescription('As senhas informadas devem ser iguais.');
      setDialogOpen(true);
      return;
    }

    if (formData.password.length < 6) {
      setDialogType('error');
      setDialogTitle('Senha muito curta');
      setDialogDescription('A senha deve ter no mínimo 6 caracteres.');
      setDialogOpen(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/customers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          cnpj_cpf: cleanCnpjCpf,
          phone: formData.phone || null,
          password: formData.password,
          company_id: company.id,
        }),
      });

      if (res.ok) {
        const customer = await res.json();
        setUser(customer);

        setDialogType('confirmation');
        setDialogTitle('Cadastro realizado!');
        setDialogDescription(`Bem-vindo(a), ${customer.name}!`);
        setDialogOpen(true);

        setTimeout(() => router.push(redirect), 1500);
      } else {
        const err = await res.json().catch(() => ({}));
        setDialogType('error');
        setDialogTitle('Erro ao cadastrar');
        setDialogDescription(err?.error || 'Não foi possível criar sua conta. Tente novamente.');
        setDialogOpen(true);
      }
    } catch (error) {
      console.error('Register error:', error);
      setDialogType('error');
      setDialogTitle('Erro inesperado');
      setDialogDescription('Erro ao tentar cadastrar o cliente. Verifique sua conexão e tente novamente.');
      setDialogOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white shadow rounded p-6">
          {company.logo_url && (
            <div className="flex justify-center mb-4">
              <img src={company.logo_url} alt={company.name} className="h-16 object-contain" />
            </div>
          )}

          <h2 className="text-xl font-bold mb-4 text-center">Criar Conta — {company.name}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome Completo *</Label>
              <Input id="name" value={formData.name} onChange={handleChange} required disabled={loading} />
            </div>

            {/* CPF/CNPJ */}
            <div>
              <Label htmlFor="cnpjCpf">CPF/CNPJ *</Label>
              <Input
                id="cnpjCpf"
                type="text"
                value={formData.cnpjCpf}
                onChange={handleChange}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                maxLength={18}
                required
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="email">E-mail *</Label>
              <Input id="email" type="email" value={formData.email} onChange={handleChange} required disabled={loading} />
            </div>

            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={formData.phone} onChange={handleChange} disabled={loading} />
            </div>

            {/* Senha */}
            <div className="space-y-1">
              <Label htmlFor="password">Senha (mín. 6 caracteres) *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading}
                  aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
                </Button>
              </div>
              {isPasswordTooShort && (
                <p className="text-xs text-red-600 mt-1">A senha deve ter no mínimo 6 caracteres.</p>
              )}
            </div>

            {/* Confirmar Senha */}
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  disabled={loading}
                  aria-label={showConfirmPassword ? 'Esconder confirmação de senha' : 'Mostrar confirmação de senha'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
                </Button>
              </div>
              {passwordsMismatch && (
                <p className="text-xs text-red-600 mt-1">As senhas não coincidem.</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              {loading ? 'Cadastrando...' : 'Criar Conta'}
            </Button>

            <div className="text-sm text-center text-gray-600 mt-2">
              Já tem conta?{' '}
              <a className="text-blue-600 hover:underline" href={`/empresa/${slug}/loginCustomer`}>
                Faça login
              </a>
            </div>
          </form>
        </div>
      </div>

      <ConfirmationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={dialogType}
        title={dialogTitle}
        description={dialogDescription}
        buttons={[
          {
            label: dialogType === 'confirmation' ? 'Ir para a loja' : 'Fechar',
            onClick: () => {
              if (dialogType === 'confirmation') router.push(redirect);
            },
            variant: 'default',
          },
        ]}
      />
    </>
  );
}