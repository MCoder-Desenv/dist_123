'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, AlertCircle, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext'; // ✅ Adicionado uso do contexto
import { buscarCEP } from '@/app/api/public/utils/busca-cep';

interface CartItem {
  product_id: string;
  product_name: string;
  variant_id?: string | null;
  variant_name?: string;
  unit_price: number;
  quantity: number;
}

interface Company {
  id: string;
  name: string;
  logo_url?: string;
  slug: string;
}

interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  // adicione outros campos relevantes do customers (ex.: code) conforme necessário
  code?: string | null;
}

/** Normaliza/encode e retorna a URL pública para usar em <img src=""> */
function getFileUrl(key?: string | null) {
  if (!key) return null;

  // já é data url
  if (key.startsWith('data:')) return key;

  // já é URL absoluta ou rota pública esperada
  if (/^https?:\/\//.test(key) || key.startsWith('//') || key.startsWith('/api/public-files/')) {
    return key;
  }

  // remove slashes iniciais e prefixes comuns
  const normalized = key.replace(/^\/+/, '').replace(/^uploads\//, '');

  // encode por segmento para preservar '/'
  const encoded = normalized.split('/').map(encodeURIComponent).join('/');

  return `/api/public-files/${encoded}`;
}

export function CheckoutPage({ company }: { company: Company }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  // logo handling
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    // reset quando a logo mudar
    setLogoFailed(false);
  }, [company.logo_url]);

  // email check states
  const [emailChecked, setEmailChecked] = useState(false);
  const [previewCustomer, setPreviewCustomer] = useState<Customer | null>(null);
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_password: '',
    customer_confirm_password: '',
    delivery_type: 'DELIVERY',
    payment_method: 'PIX',
    address: '',
    numeric: '',
    city: '',
    state: '',
    zip_code: '',
    notes: '',
  });

  const handleBuscarCEP = async () => {
  const cepRaw = formData.zip_code || '';
  const cepOnly = cepRaw.replace(/\D/g, '');

  if (cepOnly.length !== 8) {
    toast.error('Digite um CEP válido (8 dígitos).');
    return;
  }

  setCepLoading(true);
    try {
      const data = await buscarCEP(cepOnly);

      // ViaCEP fornece: logradouro, bairro, localidade, uf, etc.
      const street = data.logradouro || '';
      const neighborhood = data.bairro || '';
      const city = data.localidade || '';
      const state = data.uf || '';

      const addressValue = [street, neighborhood].filter(Boolean).join(', ');

      setFormData(prev => ({
        ...prev,
        address: addressValue || prev.address,
        city: city || prev.city,
        state: state || prev.state,
        zip_code: cepOnly,
      }));

      toast.success('CEP preenchido com sucesso.');
    } catch (err: any) {
      console.error('Erro ao buscar CEP:', err);
      const message = err?.message || 'Erro ao buscar o CEP.';
      toast.error(message);
    } finally {
      setCepLoading(false);
    }
  };

  const handleDeliveryTypeChange = (value: string) => {
    // se for entrega, apenas atualiza o tipo
    if (value === 'DELIVERY') {
      setFormData(prev => ({ ...prev, delivery_type: value }));
      return;
    }

    // para qualquer outro tipo (ex: RETIRADA), limpa os campos de entrega
    setFormData(prev => ({
      ...prev,
      delivery_type: value,
      address: '',
      numeric: '',
      city: '',
      state: '',
      zip_code: '',
      // se você tiver campos adicionais como number/complement, limpe aqui:
      // number: '',
      // complement: '',
    }));

    // cancela qualquer busca de CEP em andamento / estado relacionado
    setCepLoading(false);
  };

  // ✅ Integração com AuthContext
  const { user } = useAuth();

  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem(`cart_${company.id}`) || '[]');
    const sanitized = raw.map((i: CartItem) => ({
      ...i,
      variant_id: i.variant_id === 'default' ? null : i.variant_id ?? null,
    }));
    setCart(sanitized);
    localStorage.setItem(`cart_${company.id}`, JSON.stringify(sanitized));
  }, [company.id]);

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();

    if (!user) {
      // fallback para localStorage caso não haja user
      const storedCustomer = localStorage.getItem(`customer_${company.id}`);
      if (storedCustomer) {
        try {
          const customer: Customer = JSON.parse(storedCustomer);
          setExistingCustomer(customer);
          setEmailChecked(true);
          setShowPasswordField(false);
          setShowRegisterForm(false);
          setPreviewCustomer(null);
          setFormData(prev => ({
            ...prev,
            customer_name: customer.name || prev.customer_name,
            customer_email: customer.email || prev.customer_email,
            customer_phone: customer.phone || prev.customer_phone || '',
          }));
        } catch (e) {
          // ignore
        }
      }
      return;
    }

    const fetchCustomerFromCustomersTable = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/public/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            // enviamos user_id (será usado para procurar customer.id)
            user_id: user.id,
            company_id: company.id,
          }),
        });

        if (controller.signal.aborted) return;

        if (!res.ok) {
          console.error('Erro ao buscar customer:', res.status, await res.text());
          setLoading(false);
          return;
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          console.error('Resposta da API não é JSON:', await res.text());
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (aborted) return;

        if (data?.customer) {
          const customer: Customer = data.customer;
          setExistingCustomer(customer);
          setEmailChecked(true);
          setShowPasswordField(false);
          setShowRegisterForm(false);
          setPreviewCustomer(null);
          try {
            localStorage.setItem(`customer_${company.id}`, JSON.stringify(customer));
          } catch (e) {
            // ignore
          }
          setFormData(prev => ({
            ...prev,
            customer_name: customer.name || prev.customer_name,
            customer_email: customer.email || prev.customer_email,
            customer_phone: customer.phone || prev.customer_phone || '',
          }));
        } else {
          // não encontrou customer com esse id na company — deixa pronto para cadastro
          setExistingCustomer(null);
          setFormData(prev => ({
            ...prev,
            customer_email: user.email || prev.customer_email,
          }));
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Erro fetch customer by user:', err);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    };

    fetchCustomerFromCustomersTable();

    return () => {
      aborted = true;
      controller.abort();
    };
  }, [company.id, user]);

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const delivery_fee = formData.delivery_type === 'DELIVERY' ? 0.0 : 0;
  const total = subtotal + delivery_fee;

  const checkEmail = async () => {
    if (!formData.customer_email || !formData.customer_email.includes('@')) {
      toast.error('Digite um e-mail válido');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/customers/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.customer_email,
          company_id: company.id,
        }),
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Resposta não é JSON:', await res.text());
        throw new Error('Erro na comunicação com o servidor');
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro na verificação');
      }

      const data = await res.json();
      setEmailChecked(true);

      if (data.exists) {
        setPreviewCustomer(data.customer || null);
        setShowPasswordField(true);
        setShowRegisterForm(false);
        setFormData(prev => ({
          ...prev,
          customer_name: data.customer?.name || prev.customer_name,
          customer_phone: data.customer?.phone || prev.customer_phone || '',
        }));
        toast.info('E-mail cadastrado. Digite sua senha para continuar.');
      } else {
        setPreviewCustomer(null);
        setShowRegisterForm(true);
        setShowPasswordField(false);
        setFormData(prev => ({
          ...prev,
          customer_name: '',
          customer_phone: prev.customer_phone || '',
        }));
        toast.info('E-mail não cadastrado — complete seu cadastro.');
      }
    } catch (error) {
      console.error('Check email error:', error);
      toast.error('Erro ao verificar e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const loginCustomer = async () => {
    if (!formData.customer_password) {
      toast.error('Digite sua senha');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/customers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.customer_email,
          password: formData.customer_password,
          company_id: company.id,
        }),
      });

      if (res.ok) {
        const customer: Customer = await res.json();
        setExistingCustomer(customer);
        localStorage.setItem(`customer_${company.id}`, JSON.stringify(customer));
        setShowPasswordField(false);
        setPreviewCustomer(null);
        setEmailChecked(true);
        setFormData(prev => ({
          ...prev,
          customer_name: customer.name || prev.customer_name,
          customer_phone: customer.phone || prev.customer_phone || '',
          customer_password: '',
        }));
        toast.success('Login realizado!');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || 'Senha incorreta');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const registerCustomer = async () => {
    if (!formData.customer_name || !formData.customer_password || !formData.customer_confirm_password) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (formData.customer_password !== formData.customer_confirm_password) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (formData.customer_password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/customers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.customer_email,
          password: formData.customer_password,
          name: formData.customer_name,
          phone: formData.customer_phone,
          company_id: company.id,
        }),
      });

      if (res.ok) {
        const customer: Customer = await res.json();
        setExistingCustomer(customer);
        setCustomerStoredAfterRegister(customer);
        setShowRegisterForm(false);
        setEmailChecked(true);
        toast.success('Cadastro realizado!');
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.error || 'Erro ao criar cadastro');
      }
    } catch (error) {
      console.error('Register error:', error);
      toast.error('Erro ao criar cadastro');
    } finally {
      setLoading(false);
    }
  };

  const setCustomerStoredAfterRegister = (customer: Customer) => {
    setExistingCustomer(customer);
    localStorage.setItem(`customer_${company.id}`, JSON.stringify(customer));
    setFormData(prev => ({
      ...prev,
      customer_name: customer.name || prev.customer_name,
      customer_phone: customer.phone || prev.customer_phone || '',
      customer_password: '',
      customer_confirm_password: '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!existingCustomer) {
      toast.error('Complete seu cadastro ou faça login antes de continuar');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        company_id: company.id,
        customer_id: existingCustomer.id,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        delivery_type: formData.delivery_type,
        payment_method: formData.payment_method,
        delivery_address: formData.delivery_type === 'DELIVERY' ? {
          address: formData.address,
          numeric: formData.numeric,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
        } : null,
        notes: formData.notes,
        subtotal,
        delivery_fee,
        total_amount: total,
        items: cart.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id && item.variant_id !== 'default' ? item.variant_id : null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.unit_price * item.quantity,
        })),
      };

      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      console.log('Status:', res.status);
      console.log('Resposta:', json ?? text);

      if (!res.ok) {
        toast.error(json?.error || 'Erro ao criar pedido');
        return;
      }

      if (!json?.data?.id) {
        toast.error('Pedido não foi criado (sem ID)');
        return;
      }

      localStorage.removeItem(`cart_${company.id}`);
      toast.success('Pedido realizado com sucesso!');
      router.push(`/empresa/${company.slug}/minha-conta`);

      // const res = await fetch('/api/orders?public=true', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(orderData),
      // });

      // if (res.ok) {
      //   localStorage.removeItem(`cart_${company.id}`);
      //   toast.success('Pedido realizado com sucesso!');
      //   router.push(`/empresa/${company.slug}/minha-conta`);
      // } else {
      //   const error = await res.json().catch(() => ({}));
      //   toast.error(error.message || error.error || 'Erro ao criar pedido');
      // }
    } catch (error) {
      console.error('Order error:', error);
      toast.error('Erro ao criar pedido');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-lg mb-4">Seu carrinho está vazio</p>
            <Link href={`/empresa/${company.slug}`}>
              <Button>Ver Cardápio</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const logoSrc = getFileUrl(company.logo_url || null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            {logoSrc && !logoFailed ? (
              <img
                src={logoSrc}
                alt={company.name}
                className="h-10 w-10 object-cover rounded-lg mr-3"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <Building2 className="h-5 w-5 text-white" />
              </div>
            )}

            <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href={`/empresa/${company.slug}/carrinho`}>
            <Button variant="outline">← Voltar ao Carrinho</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Finalizar Pedido</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* E-mail Check */}
                  <div>
                    <Label htmlFor="customer_email">E-mail *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="customer_email"
                        type="email"
                        value={formData.customer_email}
                        onChange={(e) => {
                          setFormData({ ...formData, customer_email: e.target.value });
                          setEmailChecked(false);
                          setShowPasswordField(false);
                          setShowRegisterForm(false);
                          setPreviewCustomer(null);
                        }}
                        disabled={!!existingCustomer}
                        required
                      />
                      {!emailChecked ? (
                        <Button type="button" onClick={checkEmail} disabled={loading}>
                          {loading ? 'Verificando...' : 'Continuar'}
                        </Button>
                      ) : existingCustomer ? (
                        <div className="flex items-center px-3 bg-green-100 rounded">
                          <Check className="h-5 w-5 text-green-600" />
                        </div>
                      ) : previewCustomer ? (
                        <div className="flex items-center px-3 bg-yellow-100 rounded text-sm text-yellow-800">
                          Conta encontrada — informe sua senha
                        </div>
                      ) : showRegisterForm ? (
                        <div className="flex items-center px-3 bg-blue-50 rounded text-sm text-blue-800">
                          E-mail livre — crie uma conta
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Login / Register flows... (mantive o mesmo comportamento já corrigido por você) */}

                  {showPasswordField && previewCustomer && !existingCustomer && (
                    <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">
                            Você já tem cadastro conosco!
                          </p>
                          <p className="text-sm text-blue-700">
                            Digite sua senha para continuar
                          </p>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="customer_password">Senha</Label>
                        <Input
                          id="customer_password"
                          type="password"
                          value={formData.customer_password}
                          onChange={(e) => setFormData({ ...formData, customer_password: e.target.value })}
                        />
                      </div>
                      <Button type="button" onClick={loginCustomer} className="w-full" disabled={loading}>
                        {loading ? 'Entrando...' : 'Fazer Login'}
                      </Button>
                    </div>
                  )}

                  {showRegisterForm && !existingCustomer && (
                    <div className="p-4 bg-green-50 rounded-lg space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-900">
                            Novo por aqui? Complete seu cadastro
                          </p>
                          <p className="text-sm text-green-700">
                            Crie uma senha para acompanhar seus pedidos
                          </p>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="customer_name">Nome Completo *</Label>
                        <Input
                          id="customer_name"
                          value={formData.customer_name}
                          onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="customer_phone">Telefone</Label>
                        <Input
                          id="customer_phone"
                          value={formData.customer_phone}
                          onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="register_password">Senha (mín. 6 caracteres) *</Label>
                        <Input
                          id="register_password"
                          type="password"
                          value={formData.customer_password}
                          onChange={(e) => setFormData({ ...formData, customer_password: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="customer_confirm_password">Confirmar Senha *</Label>
                        <Input
                          id="customer_confirm_password"
                          type="password"
                          value={formData.customer_confirm_password}
                          onChange={(e) => setFormData({ ...formData, customer_confirm_password: e.target.value })}
                        />
                      </div>
                      <Button type="button" onClick={registerCustomer} className="w-full" disabled={loading}>
                        {loading ? 'Cadastrando...' : 'Criar Cadastro'}
                      </Button>
                    </div>
                  )}

                  {existingCustomer ? (
                    <>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          <strong>Cliente:</strong> {existingCustomer.name}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="customer_phone">Telefone</Label>
                        <Input
                          id="customer_phone"
                          value={formData.customer_phone}
                          onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="delivery_type">Tipo de Entrega *</Label>
                        <Select
                          value={formData.delivery_type}
                          onValueChange={(value) => handleDeliveryTypeChange(value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DELIVERY">Entrega</SelectItem>
                            <SelectItem value="RETIRADA">Retirada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.delivery_type === 'DELIVERY' && (
                        <>
                          {/* CEP + botão BUSCAR (abaixo do telefone) */}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1">
                              <Label htmlFor="zip_code">CEP</Label>
                              <Input
                                id="zip_code"
                                value={formData.zip_code}
                                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                                placeholder="00000-000"
                              />
                            </div>
                            <div className="mt-6">
                              <Button
                                type="button"
                                onClick={handleBuscarCEP}
                                disabled={cepLoading}
                                className="h-10"
                              >
                                {cepLoading ? 'Buscando...' : 'BUSCAR'}
                              </Button>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="address">Endereço *</Label>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Input
                                  id="address"
                                  className="w-full"
                                  value={formData.address}
                                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                  required
                                />
                              </div>

                              <div className="w-28">
                                <Label htmlFor="numeric" className="sr-only">N°</Label>
                                <Input
                                  id="numeric"
                                  className="w-full"
                                  value={formData.numeric}
                                  onChange={(e) => setFormData({ ...formData, numeric: e.target.value })}
                                  placeholder="Nº"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="city">Cidade *</Label>
                              <Input
                                id="city"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="state">Estado *</Label>
                              <Input
                                id="state"
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                maxLength={2}
                                required
                              />
                            </div>
                            {/* <div>
                              <Label htmlFor="zip_code">CEP *</Label>
                              <Input
                                id="zip_code"
                                value={formData.zip_code}
                                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                                required
                              />
                            </div> */}
                          </div>
                        </>
                      )}

                      <div>
                        <Label htmlFor="payment_method">Forma de Pagamento *</Label>
                        <Select
                          value={formData.payment_method}
                          onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PIX">PIX</SelectItem>
                            <SelectItem value="PROMISSORIA">Promissória</SelectItem>
                            <SelectItem value="CARTAO_ENTREGA">Cartão na Entrega</SelectItem>
                            <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                            <SelectItem value="BOLETO">Boleto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="notes">Observações</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={3}
                        />
                      </div>

                      <Button type="submit" className="w-full" size="lg" disabled={loading}>
                        {loading ? 'Processando...' : 'Confirmar Pedido'}
                      </Button>
                    </>
                  ) : (
                    <div className="text-sm text-gray-600 mt-2">
                      Após confirmar o e-mail (login ou cadastro), o restante do formulário aparecerá para finalizar o pedido.
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4">Resumo do Pedido</h3>
                <div className="space-y-3">
                  {cart.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>
                        {item.quantity}x {item.product_name}
                        {item.variant_name && ` (${item.variant_name})`}
                      </span>
                      <span>R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t mt-4 pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxa de Entrega:</span>
                    <span>R$ {delivery_fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>R$ {total.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}