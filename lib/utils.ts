
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ===== FORMATAÇÃO =====

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR').format(dateObj);
}

export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj);
}

export function formatPhone(phone: string): string {
  // Remove tudo que não é número
  const numbers = phone.replace(/\D/g, '');
  
  // Aplica máscara baseada na quantidade de dígitos
  if (numbers.length === 11) {
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (numbers.length === 10) {
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  
  return phone;
}

export function formatCNPJ(cnpj: string): string {
  const numbers = cnpj.replace(/\D/g, '');
  
  if (numbers.length === 14) {
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return cnpj;
}

export function formatCPF(cpf: string): string {
  const numbers = cpf.replace(/\D/g, '');
  
  if (numbers.length === 11) {
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  
  return cpf;
}

// ===== VALIDAÇÕES =====

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const numbers = phone.replace(/\D/g, '');
  return numbers.length >= 10 && numbers.length <= 11;
}

export function isValidCNPJ(cnpj: string): boolean {
  const numbers = cnpj.replace(/\D/g, '');
  
  if (numbers.length !== 14) return false;
  
  // Validação básica (não implementa dígito verificador)
  return !/^(\d)\1+$/.test(numbers);
}

export function isValidCPF(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, '');
  
  if (numbers.length !== 11) return false;
  
  // Validação básica (não implementa dígito verificador)
  return !/^(\d)\1+$/.test(numbers);
}

// ===== MANIPULAÇÃO DE STRINGS =====

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/-+/g, '-') // Remove hífens duplicados
    .trim();
}

export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ===== HELPERS DE DADOS =====

export function calculateOrderTotal(items: Array<{ quantity: number; unit_price: number }>): number {
  return items.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
}

export function getOrderStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    'RECEBIDO': 'bg-blue-100 text-blue-800',
    'EM_SEPARACAO': 'bg-yellow-100 text-yellow-800',
    'PRONTO': 'bg-orange-100 text-orange-800',
    'EM_ROTA': 'bg-purple-100 text-purple-800',
    'ENTREGUE': 'bg-green-100 text-green-800',
    'CANCELADO': 'bg-red-100 text-red-800'
  };
  
  return statusColors[status] || 'bg-gray-100 text-gray-800';
}

export function getOrderStatusLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    'RECEBIDO': 'Recebido',
    'EM_SEPARACAO': 'Em Separação',
    'PRONTO': 'Pronto',
    'EM_ROTA': 'Em Rota',
    'ENTREGUE': 'Entregue',
    'CANCELADO': 'Cancelado'
  };
  
  return statusLabels[status] || status;
}

export function getPaymentMethodLabel(method: string): string {
  const methodLabels: Record<string, string> = {
    'PIX': 'PIX',
    'PROMISSORIA': 'Promissória',
    'CARTAO_ENTREGA': 'Cartão na Entrega',
    'DINHEIRO': 'Dinheiro',
    'BOLETO': 'Boleto'
  };
  
  return methodLabels[method] || method;
}

export function getUserRoleLabel(role: string): string {
  const roleLabels: Record<string, string> = {
    'ADMINISTRADOR': 'Administrador',
    'MASTER_DIST': 'Master Distribuidora',
    'ATENDENTE': 'Atendente',
    'FINANCEIRO': 'Financeiro',
    'LEITURA': 'Leitura'
  };
  
  return roleLabels[role] || role;
}

// ===== HELPERS DE UI =====

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

export function generateRandomColor(): string {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
}

// ===== HELPERS DE ARQUIVO =====

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ===== HELPERS DE PAGINAÇÃO =====

export function getPaginationInfo(page: number, limit: number, total: number) {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);
  
  return {
    totalPages,
    hasNextPage,
    hasPrevPage,
    startItem,
    endItem,
    isFirstPage: page === 1,
    isLastPage: page === totalPages
  };
}

// ===== HELPERS DE URL =====

export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  
  return searchParams.toString();
}

export function parseQueryString(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const result: Record<string, string> = {};
  
  params.forEach((value, key) => {
    result[key] = value;
  });
  
  return result;
}

// ===== HELPERS DE ERRO =====

export function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return 'Erro desconhecido';
}

export function isNetworkError(error: any): boolean {
  return error?.code === 'NETWORK_ERROR' || 
         error?.message?.includes('fetch') ||
         error?.message?.includes('network');
}
