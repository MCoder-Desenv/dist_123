
import { z } from 'zod';
import { UserRole, PaymentMethod, DeliveryType, EntryType, EntryStatus } from '@prisma/client';

// ===== AUTH VALIDATIONS =====

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres')
});

export const signupSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  firstName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  lastName: z.string().min(2, 'Sobrenome deve ter pelo menos 2 caracteres'),
  companyName: z.string().min(2, 'Nome da empresa deve ter pelo menos 2 caracteres'),
  phone: z.string().optional()
});

// ===== COMPANY VALIDATIONS =====

export const companySchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  slug: z.string()
    .min(3, 'Slug deve ter pelo menos 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  cnpj_cpf: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  active: z.boolean()
});

// ===== USER VALIDATIONS =====

export const userSchema = z.object({
  email: z.string().email('Email inválido'),
  firstName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  lastName: z.string().min(2, 'Sobrenome deve ter pelo menos 2 caracteres'),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
  active: z.boolean()
});

// ===== PRODUCT VALIDATIONS =====

export const categorySchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  sort_order: z.number().optional()
});

export const productSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  category_id: z.string().uuid('ID da categoria inválido'),
  sku: z.string().optional(),
  base_price: z.number().positive('Preço deve ser positivo'),
  active: z.boolean()
});

export const variantSchema = z.object({
  name: z.string().min(1, 'Nome da variação é obrigatório'),
  volume: z.string().optional(),
  unit_type: z.string().optional(),
  price_modifier: z.number().default(0),
  stock_quantity: z.number().optional()
});

// ===== ORDER VALIDATIONS =====

export const orderSchema = z.object({
  customer_id: z.string().uuid().optional(),
  customer_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  customer_email: z.string().email('Email inválido'),
  customer_phone: z.string().optional().default(''),
  delivery_address: z.any().optional().nullable(),
  delivery_type: z.nativeEnum(DeliveryType),
  payment_method: z.nativeEnum(PaymentMethod),
  notes: z.string().optional().default(''),
  subtotal: z.number().optional(),
  delivery_fee: z.number().optional(),
  total_amount: z.number().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    variant_id: z.string().uuid().optional().nullable(),
    quantity: z.number().positive(),
    unit_price: z.number().optional(),
    total_price: z.number().optional()
  })).min(1, 'Pelo menos um item é obrigatório')
}).passthrough();

// ===== FINANCIAL VALIDATIONS =====

export const financialEntrySchema = z.object({
  type: z.nativeEnum(EntryType),
  amount: z.number().positive('Valor deve ser positivo'),
  description: z.string().min(2, 'Descrição deve ter pelo menos 2 caracteres'),
  category: z.string().optional(),
  payment_method: z.nativeEnum(PaymentMethod).optional(),
  due_date: z.date().optional(),
  paid_date: z.date().optional(),
  status: z.nativeEnum(EntryStatus)
});

// ===== PAGINATION VALIDATIONS =====

export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('asc')
});
