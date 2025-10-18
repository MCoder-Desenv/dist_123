// src/components/public/register-customer.tsx
'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

interface Company {
  id: string;
  name: string;
  logo_url?: string;
  slug?: string;
}

export default function RegisterCustomer({ slug, company }: { slug: string; company: Company }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') || `/empresa/${slug}`;

  const { setUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
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
          phone: formData.phone,
          password: formData.password,
          company_id: company.id,
        }),
      });

      if (res.ok) {
        const customer = await res.json();
        setUser(customer); // atualiza contexto e localStorage
        toast.success('Cadastro realizado com sucesso!');
        router.push(redirect);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || 'Erro ao criar conta');
      }
    } catch (err) {
      console.error('Register error:', err);
      toast.error('Erro ao tentar cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white shadow rounded p-6">
        <h2 className="text-xl font-bold mb-4">Criar Conta — {company.name}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome Completo *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div>
            <Label htmlFor="password">Senha (mín. 6 caracteres) *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Cadastrando...' : 'Criar Conta'}
          </Button>

          <div className="text-sm text-center text-gray-600 mt-2">
            Já tem conta? <a className="text-blue-600" href={`/empresa/${slug}/loginCustomer`}>Faça login</a>
          </div>
        </form>
      </div>
    </div>
  );
}