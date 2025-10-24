// app/(somepath)/checkout-page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { buscarCEP } from '@/app/api/public/utils/busca-cep';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

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
  cnpj_cpf: string;
  email?: string;
  name: string;
  phone?: string | null;
  code?: string | null;
}

type DialogButton = {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'destructive';
};

/** Normaliza/encode e retorna a URL pública para usar em <img src=""> */
function getFileUrl(key?: string | null) {
  if (!key) return null;

  if (key.startsWith('data:')) return key;

  if (/^https?:\/\//.test(key) || key.startsWith('//') || key.startsWith('/api/public-files/')) {
    return key;
  }

  const normalized = key.replace(/^\/+/, '').replace(/^uploads\//, '');
  const encoded = normalized.split('/').map(encodeURIComponent).join('/');

  return `/api/public-files/${encoded}`;
}

/** Formata CPF/CNPJ */
function formatCpfCnpj(value: string) {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 11) {
    // CPF: 000.000.000-00
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // CNPJ: 00.000.000/0000-00
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
}

/** Valida CPF */
function isValidCPF(cpf: string) {
  const numbers = cpf.replace(/\D/g, '');
  
  if (numbers.length !== 11) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(numbers.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(numbers.charAt(10))) return false;
  
  return true;
}

/** Valida CNPJ (implementação corrigida) */
function isValidCNPJ(cnpj: string) {
  const numbers = cnpj.replace(/\D/g, '');

  if (numbers.length !== 14) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;

  // calcula o dígito verificador
  const calc = (sliceLen: number) => {
    let sum = 0;
    let pos = sliceLen - 7;
    for (let i = 0; i < sliceLen; i++) {
      sum += parseInt(numbers.charAt(i)) * pos;
      pos--;
      if (pos < 2) pos = 9;
    }
    const res = sum % 11;
    return res < 2 ? 0 : 11 - res;
  };

  const firstVerifier = calc(12);
  if (firstVerifier !== parseInt(numbers.charAt(12))) return false;

  const secondVerifier = calc(13);
  if (secondVerifier !== parseInt(numbers.charAt(13))) return false;

  return true;
}

/** Valida CPF ou CNPJ */
function isValidCpfCnpj(value: string) {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length === 11) {
    return isValidCPF(value);
  } else if (numbers.length === 14) {
    return isValidCNPJ(value);
  }
  
  return false;
}

export function CheckoutPage({ company }: { company: Company }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    setLogoFailed(false);
  }, [company.logo_url]);

  const [cpfCnpjChecked, setCpfCnpjChecked] = useState(false);
  const [previewCustomer, setPreviewCustomer] = useState<Customer | null>(null);
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  // Estados para controlar visibilidade das senhas
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Refs (ainda disponíveis, mas usaremos fallbacks via DOM)
  const registerSectionRef = useRef<HTMLDivElement | null>(null);
  const registerNameRef = useRef<HTMLInputElement | null>(null);

  // Estados para o Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'confirmation' | 'alert' | 'error'>('confirmation');
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogDescription, setDialogDescription] = useState('');
  const [dialogButtons, setDialogButtons] = useState<DialogButton[]>([]);
  const autoCloseTimerRef = useRef<number | null>(null);

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_cnpj_cpf: '',    
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

  // Verifica se as senhas coincidem
  const passwordsMatch = formData.customer_password === formData.customer_confirm_password;
  const showPasswordMismatch = formData.customer_confirm_password.length > 0 && !passwordsMatch;

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
    if (value === 'DELIVERY') {
      setFormData(prev => ({ ...prev, delivery_type: value }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      delivery_type: value,
      address: '',
      numeric: '',
      city: '',
      state: '',
      zip_code: '',
    }));

    setCepLoading(false);
  };

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
      const storedCustomer = localStorage.getItem(`customer_${company.id}`);
      if (storedCustomer) {
        try {
          const customer: Customer = JSON.parse(storedCustomer);
          setExistingCustomer(customer);
          setCpfCnpjChecked(true);
          setShowPasswordField(false);
          setShowRegisterForm(false);
          setPreviewCustomer(null);
          setFormData(prev => ({
            ...prev,
            customer_name: customer.name || prev.customer_name,
            customer_cnpj_cpf: customer.cnpj_cpf || prev.customer_cnpj_cpf,
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
          setCpfCnpjChecked(true);
          setShowPasswordField(false);
          setShowRegisterForm(false);
          setPreviewCustomer(null);
          try {
            localStorage.setItem(`customer_${company.id}`, JSON.stringify(customer));
          } catch (e) {
            // ignore
          }
          // CORREÇÃO: usar a chave correta customer_cnpj_cpf
          setFormData(prev => ({
            ...prev,
            customer_name: customer.name || prev.customer_name,
            customer_cnpj_cpf: customer.cnpj_cpf || prev.customer_cnpj_cpf,
            customer_email: customer.email || prev.customer_email,
            customer_phone: customer.phone || prev.customer_phone || '',
          }));
        } else {
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

  // Helper: lê valor do input pelo id (fallback para formData)
  const getDomInputValue = (id: string, fallback: string) => {
    try {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && typeof el.value === 'string') return el.value;
    } catch (e) {
      // ignore
    }
    return fallback;
  };

  const checkCpfCnpj = async () => {
    // Obter o valor diretamente do DOM como fallback (evita problemas de forwardRef)
    const rawValue = getDomInputValue('customer_cnpj_cpf', formData.customer_cnpj_cpf);
    const cleanCpfCnpj = rawValue.replace(/\D/g, '');

    if (!cleanCpfCnpj || (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14)) {
      toast.error('Digite um CPF (11 dígitos) ou CNPJ (14 dígitos) válido');
      return;
    }

    if (!isValidCpfCnpj(rawValue)) {
      toast.error('CPF/CNPJ inválido');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/customers/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj_cpf: cleanCpfCnpj,
          company_id: company.id,
        }),
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Se a API responder 204/empty para "não existe", tratar como exists = false
        if (res.status === 204) {
          // tratar como não existe
          const formatted = formatCpfCnpj(cleanCpfCnpj);
          setPreviewCustomer(null);
          setShowRegisterForm(true);
          setShowPasswordField(false);
          setFormData(prev => ({
            ...prev,
            customer_cnpj_cpf: formatted,
            customer_name: '',
            customer_email: '',
            customer_phone: prev.customer_phone || '',
          }));
          setTimeout(() => {
            // Tentar rolar e focar (fallback via DOM)
            try {
              registerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              const nameEl = document.getElementById('customer_name') as HTMLInputElement | null;
              nameEl?.focus();
            } catch (e) {}
          }, 80);
          toast.info('CPF/CNPJ não cadastrado — complete seu cadastro.');
          setLoading(false);
          return;
        }

        console.error('Resposta não é JSON:', await res.text());
        throw new Error('Erro na comunicação com o servidor');
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro na verificação');
      }

      const data = await res.json();
      setCpfCnpjChecked(true);

      if (data.exists) {
        setPreviewCustomer(data.customer || null);
        setShowPasswordField(true);
        setShowRegisterForm(false);
        setFormData(prev => ({
          ...prev,
          customer_name: data.customer?.name || prev.customer_name,
          customer_email: data.customer?.email || prev.customer_email,
          customer_phone: data.customer?.phone || prev.customer_phone || '',
        }));
        toast.info('CPF/CNPJ cadastrado. Digite sua senha para continuar.');
      } else {
        // CPF/CNPJ não existe => abrir cadastro na mesma tela, preencher o CPF/CNPJ e focar
        const formatted = formatCpfCnpj(cleanCpfCnpj);
        setPreviewCustomer(null);
        setShowRegisterForm(true);
        setShowPasswordField(false);
        setFormData(prev => ({
          ...prev,
          customer_cnpj_cpf: formatted, // garante que o CPF/CNPJ permaneça preenchido no form de cadastro
          customer_name: '',
          customer_email: '',
          customer_phone: prev.customer_phone || '',
        }));

        // Pequeno timeout para esperar o DOM atualizar e então rolar/focar (usa DOM fallback)
        setTimeout(() => {
          try {
            registerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const nameEl = document.getElementById('customer_name') as HTMLInputElement | null;
            nameEl?.focus();
          } catch (e) {
            // ignore
          }
        }, 80);

        toast.info('CPF/CNPJ não cadastrado — complete seu cadastro.');
      }
    } catch (error) {
      console.error('Check CPF/CNPJ error:', error);
      toast.error('Erro ao verificar CPF/CNPJ. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const closeDialog = () => {
    // limpar timer automático se existir
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setDialogOpen(false);
    setDialogButtons([]);
  };

  const loginCustomer = async () => {
    if (!formData.customer_password) {
      toast.error('Digite sua senha');
      return;
    }

    const rawValue = getDomInputValue('customer_cnpj_cpf', formData.customer_cnpj_cpf);
    const cleanCpfCnpj = rawValue.replace(/\D/g, '');

    setLoading(true);
    try {
      const res = await fetch('/api/customers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj_cpf: cleanCpfCnpj,
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
        setCpfCnpjChecked(true);
        setFormData(prev => ({
          ...prev,
          customer_name: customer.name || prev.customer_name,
          customer_email: customer.email || prev.customer_email,
          customer_phone: customer.phone || prev.customer_phone || '',
          customer_password: '',
        }));
        toast.success('Login realizado!');
        return;
      }

      const err = await res.json().catch(() => ({}));
      const message = err?.error || 'Erro ao fazer login.';
      const suggestion = err?.suggestion || null;
      const suggestionUrl = err?.suggestion_url || err?.signup_url || null;

      let buttons: DialogButton[] = [{ label: 'OK', onClick: closeDialog, variant: 'default' }];

      if (res.status === 401) {
        setDialogType('error');
        setDialogTitle('Senha incorreta');
        setDialogDescription(message + (suggestion ? `\n\n${suggestion}` : '\nSe esqueceu a senha, solicite ajuda à empresa.'));
        buttons = [{ label: 'OK', onClick: closeDialog, variant: 'default' }];
      } else if (res.status === 404) {
        setDialogType('alert');
        setDialogTitle('CPF/CNPJ não cadastrado');
        setDialogDescription(message + (suggestion ? `\n\n${suggestion}` : 'Deseja criar uma conta?'));
        buttons = [
          {
            label: 'Criar conta',
            onClick: () => {
              closeDialog();
              setShowRegisterForm(true);
              setTimeout(() => {
                try {
                  registerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  const nameEl = document.getElementById('customer_name') as HTMLInputElement | null;
                  nameEl?.focus();
                } catch (e) {}
              }, 80);
            },
            variant: 'default',
          },
          { label: 'Fechar', onClick: closeDialog, variant: 'outline' },
        ];
        if (suggestionUrl) {
          buttons.unshift({
            label: 'Abrir link',
            onClick: () => { closeDialog(); window.open(suggestionUrl, '_blank'); },
            variant: 'default',
          });
        }
      } else if (res.status === 403) {
        setDialogType('error');
        setDialogTitle('Conta desativada');
        setDialogDescription(message + (suggestion ? `\n\n${suggestion}` : 'Entre em contato com a empresa para reativá-la.'));
        buttons = [{ label: 'Fechar', onClick: closeDialog, variant: 'default' }];
      } else {
        setDialogType('error');
        setDialogTitle('Erro ao fazer login');
        setDialogDescription(message + (suggestion ? `\n\n${suggestion}` : 'Tente novamente mais tarde.'));
        buttons = [
          { label: 'Fechar', onClick: closeDialog, variant: 'default' },
          { label: 'Tentar novamente', onClick: () => { closeDialog(); }, variant: 'outline' },
        ];
      }

      setDialogButtons(buttons);
      setDialogOpen(true);
    } catch (error) {
      console.error('Login error:', error);
      setDialogType('error');
      setDialogTitle('Erro ao fazer login');
      setDialogDescription('Não foi possível conectar ao servidor. Tente novamente.');
      setDialogButtons([{ label: 'Fechar', onClick: closeDialog, variant: 'default' }]);
      setDialogOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const registerCustomer = async () => {
    // Garantir que o CPF seja lido do DOM caso o estado esteja desatualizado
    const domCpfValue = getDomInputValue('customer_cnpj_cpf', formData.customer_cnpj_cpf);
    const cleanCpfCnpj = domCpfValue.replace(/\D/g, '');

    // atualiza formData com o CPF formatado (garantia)
    const formatted = formatCpfCnpj(cleanCpfCnpj);
    setFormData(prev => ({ ...prev, customer_cnpj_cpf: formatted }));

    // Validações locais rápidas (reduz requisições desnecessárias)
    if (!formData.customer_name || !cleanCpfCnpj || !formData.customer_password || !formData.customer_confirm_password) {
      setDialogType('error');
      setDialogTitle('Campos obrigatórios');
      setDialogDescription('Preencha nome, CPF/CNPJ e as senhas antes de continuar.');
      setDialogButtons([{ label: 'OK', onClick: closeDialog }]);
      setDialogOpen(true);
      return;
    }

    if (formData.customer_password.length < 6) {
      setDialogType('error');
      setDialogTitle('Senha fraca');
      setDialogDescription('A senha deve ter no mínimo 6 caracteres.');
      setDialogButtons([{ label: 'OK', onClick: closeDialog }]);
      setDialogOpen(true);
      return;
    }

    if (formData.customer_password !== formData.customer_confirm_password) {
      setDialogType('error');
      setDialogTitle('Senhas não coincidem');
      setDialogDescription('As senhas informadas não coincidem. Verifique e tente novamente.');
      setDialogButtons([{ label: 'OK', onClick: closeDialog }]);
      setDialogOpen(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/customers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj_cpf: cleanCpfCnpj,
          email: formData.customer_email,
          password: formData.customer_password,
          name: formData.customer_name,
          phone: formData.customer_phone,
          company_id: company.id,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      const body = contentType.includes('application/json') ? await res.json().catch(() => ({})) : null;

      if (res.ok) {
        const customer: Customer = body;
        setExistingCustomer(customer);
        setCustomerStoredAfterRegister(customer);
        setShowRegisterForm(false);
        setCpfCnpjChecked(true);

        // abrir dialog de sucesso com apenas OK e auto-close em 8s
        setDialogType('confirmation');
        setDialogTitle('Cadastro realizado!');
        setDialogDescription('Seu cadastro foi criado com sucesso. Você já pode finalizar o pedido.');
        setDialogButtons([{ label: 'OK', onClick: closeDialog }]);
        setDialogOpen(true);

        // auto close depois de 8 segundos
        if (autoCloseTimerRef.current) {
          clearTimeout(autoCloseTimerRef.current);
        }
        autoCloseTimerRef.current = window.setTimeout(() => {
          setDialogOpen(false);
          autoCloseTimerRef.current = null;
        }, 8000);

      } else {
        // Exibir erro retornado pelo backend de forma amigável no Dialog
        const errorMessage = body?.error || 'Erro ao criar cadastro';
        setDialogType('error');
        setDialogTitle('Erro ao criar cadastro');
        // se backend retornar field, podemos incluir (opcional)
        const fieldInfo = body?.field ? `Campo: ${body.field}\n\n` : '';
        setDialogDescription(`${fieldInfo}${errorMessage}`);
        setDialogButtons([{ label: 'OK', onClick: closeDialog }]);
        setDialogOpen(true);
      }
    } catch (error) {
      console.error('Register error:', error);
      setDialogType('error');
      setDialogTitle('Erro ao criar cadastro');
      setDialogDescription('Não foi possível conectar ao servidor. Tente novamente.');
      setDialogButtons([{ label: 'OK', onClick: closeDialog }]);
      setDialogOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const setCustomerStoredAfterRegister = (customer: Customer) => {
    setExistingCustomer(customer);
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
        customer_cnpj_cpf: formData.customer_cnpj_cpf,
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
        items: cart.map(item => {
        const hasValidVariant = item.variant_id && item.variant_id !== 'default' && cart.some(v => v.variant_id === item.variant_id);
        return {
          product_id: item.product_id,
          variant_id: hasValidVariant ? item.variant_id : null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.unit_price * item.quantity,
        };
      }),

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

      if (!res.ok) {
        setDialogType('error');
        setDialogTitle('Erro ao processar pedido');
        setDialogDescription(json?.error || 'Não foi possível finalizar seu pedido. Por favor, tente novamente.');
        setDialogButtons([{ label: 'Fechar', onClick: closeDialog, variant: 'default' }]);
        setDialogOpen(true);
        return;
      }

      if (!json?.data?.id) {
        setDialogType('error');
        setDialogTitle('Erro ao criar pedido');
        setDialogDescription('O pedido não foi criado corretamente. Entre em contato com o suporte.');
        setDialogButtons([{ label: 'Fechar', onClick: closeDialog, variant: 'default' }]);
        setDialogOpen(true);
        return;
      }

      // Sucesso!
      localStorage.removeItem(`cart_${company.id}`);
      setDialogType('confirmation');
      setDialogTitle('Pedido realizado com sucesso! 🎉');
      setDialogDescription(
        `Seu pedido #${json.data.id.slice(0, 8)} foi confirmado e está sendo processado. Você pode acompanhá-lo na sua conta.`
      );
      setDialogButtons([
        { label: 'Ver Meus Pedidos', onClick: () => { closeDialog(); router.push(`/empresa/${company.slug}/minha-conta`); }, variant: 'default' },
        { label: 'Voltar ao Cardápio', onClick: () => { closeDialog(); router.push(`/empresa/${company.slug}`); }, variant: 'outline' },
      ]);
      setDialogOpen(true);
    } catch (error) {
      console.error('Order error:', error);
      setDialogType('error');
      setDialogTitle('Erro inesperado');
      setDialogDescription('Ocorreu um erro ao processar seu pedido. Verifique sua conexão e tente novamente.');
      setDialogButtons([{ label: 'Fechar', onClick: closeDialog, variant: 'default' }]);
      setDialogOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpfCnpj(e.target.value);
    setFormData({ ...formData, customer_cnpj_cpf: formatted });
    setCpfCnpjChecked(false);
    setShowPasswordField(false);
    setShowRegisterForm(false);
    setPreviewCustomer(null);
  };

  // ---- Validation helpers for register UI ----
  const registerNameInvalid = showRegisterForm && formData.customer_name.trim().length === 0;
  const passwordTooShort = showRegisterForm && formData.customer_password.length > 0 && formData.customer_password.length < 6;
  const confirmEmpty = showRegisterForm && formData.customer_confirm_password.length === 0;
  const registerValid = showRegisterForm
    && formData.customer_name.trim().length > 0
    && formData.customer_password.length >= 6
    && formData.customer_confirm_password.length > 0
    && passwordsMatch;

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
                  {/* CPF/CNPJ Check */}
                  <div>
                    <Label htmlFor="customer_cnpj_cpf">CPF/CNPJ *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="customer_cnpj_cpf"
                        type="text"
                        value={formData.customer_cnpj_cpf}
                        onChange={handleCpfCnpjChange}
                        disabled={!!existingCustomer}
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        maxLength={18}
                      />
                      {!cpfCnpjChecked ? (
                        <Button type="button" onClick={checkCpfCnpj} disabled={loading}>
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
                          CPF/CNPJ livre — crie uma conta
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Login Flow */}
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
                        <div className="relative">
                          <Input
                            id="customer_password"
                            type={showLoginPassword ? 'text' : 'password'}
                            value={formData.customer_password}
                            onChange={(e) => setFormData({ ...formData, customer_password: e.target.value })}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showLoginPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <Button type="button" onClick={loginCustomer} className="w-full" disabled={loading}>
                        {loading ? 'Entrando...' : 'Fazer Login'}
                      </Button>
                    </div>
                  )}

                  {/* Register Flow */}
                  {showRegisterForm && !existingCustomer && (
                    <div ref={registerSectionRef} className="p-4 bg-green-50 rounded-lg space-y-3">
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
                          ref={registerNameRef as any}
                          value={formData.customer_name}
                          onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                          className={registerNameInvalid ? 'border-red-500 focus:ring-red-500' : ''}
                          aria-invalid={registerNameInvalid}
                        />
                        {registerNameInvalid && (
                          <p className="text-sm text-red-600 mt-1">Nome é obrigatório</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="customer_email">E-mail</Label>
                        <Input
                          id="customer_email"
                          type="email"
                          value={formData.customer_email}
                          onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
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
                        <div className="relative">
                          <Input
                            id="register_password"
                            type={showRegisterPassword ? 'text' : 'password'}
                            value={formData.customer_password}
                            onChange={(e) => setFormData({ ...formData, customer_password: e.target.value })}
                            className={`${passwordTooShort ? 'border-red-500 focus:ring-red-500' : ''} pr-10`}
                            aria-invalid={passwordTooShort}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showRegisterPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {passwordTooShort && (
                          <p className="text-sm text-red-600 mt-1">A senha deve ter pelo menos 6 caracteres</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="customer_confirm_password">Confirmar Senha *</Label>
                        <div className="relative">
                          <Input
                            id="customer_confirm_password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={formData.customer_confirm_password}
                            onChange={(e) => setFormData({ ...formData, customer_confirm_password: e.target.value })}
                            className={`${showPasswordMismatch ? 'border-red-500 focus:ring-red-500' : ''} pr-10`}
                            aria-invalid={showPasswordMismatch}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {showPasswordMismatch && (
                          <p className="text-sm text-red-600 mt-1">As senhas não coincidem</p>
                        )}
                        {!showPasswordMismatch && confirmEmpty && (
                          <p className="text-sm text-gray-600 mt-1">Confirme sua senha</p>
                        )}
                      </div>

                      <Button
                        type="button"
                        onClick={registerCustomer}
                        className="w-full"
                        disabled={loading || !registerValid}
                      >
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
                        <p className="text-sm text-gray-600">
                          <strong>CPF/CNPJ:</strong> {existingCustomer.cnpj_cpf}
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
                      Após confirmar o CPF/CNPJ (login ou cadastro), o restante do formulário aparecerá para finalizar o pedido.
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

      {/* Dialog de Confirmação/Erro */}
      <ConfirmationDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDialogButtons([]);
          // se fechar manualmente limpar timer automático
          if (!open && autoCloseTimerRef.current) {
            clearTimeout(autoCloseTimerRef.current);
            autoCloseTimerRef.current = null;
          }
        }}
        type={dialogType}
        title={dialogTitle}
        description={dialogDescription}
        buttons={dialogButtons.length ? dialogButtons : (
          dialogType === 'confirmation'
            ? [
                {
                  label: 'Ver Meus Pedidos',
                  onClick: () => { setDialogOpen(false); router.push(`/empresa/${company.slug}/minha-conta`); },
                },
                {
                  label: 'Voltar ao Cardápio',
                  onClick: () => { setDialogOpen(false); router.push(`/empresa/${company.slug}`); },
                  variant: 'outline',
                },
              ]
            : [
                {
                  label: 'Tentar Novamente',
                  onClick: () => setDialogOpen(false),
                  variant: 'destructive',
                },
                {
                  label: 'Fechar',
                  onClick: () => setDialogOpen(false),
                  variant: 'outline',
                },
              ]
        )}
      />
    </div>
  );
}