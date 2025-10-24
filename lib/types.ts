
import { UserRole, OrderStatus, PaymentMethod, DeliveryType, EntryType, EntryStatus } from '@prisma/client';

// ===== TYPES EXPORTADOS DO PRISMA =====
export { UserRole, OrderStatus, PaymentMethod, DeliveryType, EntryType, EntryStatus };

// ===== TIPOS CUSTOMIZADOS =====

export interface User {
  id: string;
  company_id: string | null; // Null para ADMINISTRADOR
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: UserRole;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  cnpj_cpf?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  logo_url?: string;
  settings?: any;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Product {
  id: string;
  company_id: string;
  category_id: string;
  name: string;
  description?: string;
  sku?: string;
  base_price: number;
  image_url?: string;
  stock_quantity: number;
  active: boolean;
  sort_order?: number;
  created_at: Date;
  updated_at: Date;
  category?: Category;
  variants?: ProductVariant[];
}

export interface Category {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  image_url?: string;
  sort_order?: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
  products?: Product[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku?: string;
  volume?: string;
  unit_type?: string;
  price_modifier: number;
  stock_quantity: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: string;
  company_id: string;
  user_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_cnpj_cpf?: string;
  delivery_address?: any;
  delivery_type: DeliveryType;
  payment_method: PaymentMethod;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  status: OrderStatus;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  product?: Product;
  variant?: ProductVariant;
}

export interface FinancialEntry {
  id: string;
  company_id: string;
  order_id?: string;
  type: EntryType;
  amount: number;
  description: string;
  category?: string;
  payment_method?: PaymentMethod;
  due_date?: Date;
  paid_date?: Date;
  status: EntryStatus;
  created_at: Date;
  updated_at: Date;
}

// ===== API RESPONSE TYPES =====

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ===== FORM TYPES =====

export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignupFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  phone?: string;
}

export interface CompanyFormData {
  name: string;
  slug: string;
  cnpj_cpf?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

export interface ProductFormData {
  name: string;
  description?: string;
  category_id: string;
  sku?: string;
  base_price: number;
  active: boolean;
}

export interface OrderFormData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address?: any;
  delivery_type: DeliveryType;
  payment_method: PaymentMethod;
  notes?: string;
  items: {
    product_id: string;
    variant_id?: string;
    quantity: number;
  }[];
}

// ===== CONTEXT TYPES =====

export interface AppContextType {
  user: User | null;
  company: Company | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
}

// ===== CARRINHO TYPES =====

export interface CartItem {
  product_id: string;
  variant_id?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_name: string;
  variant_name?: string;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
}
