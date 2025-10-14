// src/components/public/public-menu.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Search, Building2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { QuantityModal } from './quantity-modal';
import { useAuth } from '@/context/AuthContext'; // ✅ Importa o hook

interface Company {
  id: string;
  name: string;
  logo_url?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  slug?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  products: Product[];
}

interface Product {
  id: string;
  name: string;
  description?: string;
  base_price: number | string;
  image_url?: string;
  variants?: Variant[];
}

interface Variant {
  id: string;
  name: string;
  volume?: string;
  unit_type?: string;
  price_modifier: number | string;
  image_url?: string;
}

interface SelectedVariant {
  product: Product;
  variant: Variant;
}

// Normalize keys e retorna a URL correta para usar em <img src=...>
function getFileUrl(key?: string | null) {
  if (!key) return null;

  // já é data url
  if (key.startsWith('data:')) return key;

  // já é URL absoluta ou já é rota pública do app
  if (/^https?:\/\//.test(key) || key.startsWith('//') || key.startsWith('/api/public-files/')) {
    return key;
  }

  // se veio com leading slash (ex: "/products/..."), remova
  const normalized = key.replace(/^\/+/, '').replace(/^uploads\//, '');

  // encode cada segmento (preserva /)
  const encoded = normalized.split('/').map(encodeURIComponent).join('/');

  return `/api/public-files/${encoded}`;
}

export function PublicMenu({ slug, company }: { slug: string; company: Company }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);

  // ✅ Usa o AuthContext para saber se o usuário está logado
  const { user, loading: authLoading } = useAuth();
  const isLogged = !!user;
  const checkingAuth = authLoading;

  useEffect(() => {
    fetchMenu();
    loadCart();
  }, [slug]);

  const fetchMenu = async () => {
    try {
      const res = await fetch(`/api/public/menu/${slug}`);
      if (res.ok) {
        const response = await res.json();
        if (response.success && response.data) {
          setCategories(response.data.categories || []);
        }
      }
    } catch (error) {
      console.error('Error fetching menu:', error);
      toast.error('Erro ao carregar cardápio');
    } finally {
      setLoading(false);
    }
  };

  const loadCart = () => {
    try {
      const cart = JSON.parse(localStorage.getItem(`cart_${company.id}`) || '[]');
      const count = cart.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
      const total = cart.reduce((sum: number, item: any) => sum + ((item.unit_price || 0) * (item.quantity || 0)), 0);
      setCartCount(count);
      setCartTotal(total);
    } catch (e) {
      setCartCount(0);
      setCartTotal(0);
    }
  };

  const openQuantityModal = (product: Product, variant: Variant) => {
    setSelectedVariant({ product, variant });
    setModalOpen(true);
  };

  const addToCart = (product: Product, variant: Variant, quantity: number) => {
    try {
      const cart = JSON.parse(localStorage.getItem(`cart_${company.id}`) || '[]');
      const basePrice = typeof product.base_price === 'string' ? parseFloat(product.base_price) : product.base_price;
      const modifierPrice = typeof variant.price_modifier === 'string' ? parseFloat(variant.price_modifier) : variant.price_modifier;
      const price = basePrice + modifierPrice;
      
      const existingIndex = cart.findIndex(
        (item: any) => item.product_id === product.id && item.variant_id === variant.id
      );

      if (existingIndex >= 0) {
        cart[existingIndex].quantity += quantity;
      } else {
        cart.push({
          product_id: product.id,
          product_name: product.name,
          variant_id: variant.id,
          variant_name: variant.name,
          unit_price: price,
          quantity: quantity,
        });
      }

      localStorage.setItem(`cart_${company.id}`, JSON.stringify(cart));
      loadCart();
      toast.success(`${quantity}x ${product.name} adicionado ao carrinho!`);
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Erro ao adicionar ao carrinho');
    }
  };

  const filteredCategories = categories.map(cat => ({
    ...cat,
    products: cat.products?.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [],
  })).filter(cat => cat.products.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col items-center md:flex-row md:justify-between md:items-center">
              <div className="flex items-center mb-3 md:mb-0">
                {company.logo_url ? (
                  <img
                    src={getFileUrl(company.logo_url) || ''}
                    alt={company.name}
                    className="h-12 w-12 object-cover rounded-lg mr-4"
                    onError={() => {}}
                    onLoad={() => {}}
                  />
                ) : (
                  <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center mr-4">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
                  {company.phone && <p className="text-sm text-gray-600">{company.phone}</p>}
                </div>
              </div>

              {/* Área de ações - empilhado no mobile, inline em md+ */}
              <div className="flex flex-col items-center space-y-2 w-full max-w-xs md:flex-row md:space-y-0 md:space-x-2 md:w-auto">
                {checkingAuth ? (
                  <Button className="w-full md:w-auto opacity-60">Carregando...</Button>
                ) : (
                  <>
                    {!isLogged ? (
                      <Link href={`/empresa/${slug}/loginCustomer`} className="w-full">
                        <Button className="w-full md:w-auto">Entrar</Button>
                      </Link>
                    ) : (
                      <Link href={`/empresa/${slug}/minha-conta`} className="w-full">
                        <Button variant="outline" className="w-full md:w-auto">Últimas Compras</Button>
                      </Link>
                    )}
                  </>
                )}

                {/* Carrinho sempre visível */}
                <Link href={`/empresa/${slug}/carrinho`} className="w-full">
                  <Button className="w-full md:w-auto relative">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {cartCount > 0 ? (
                      <>
                        Carrinho ({cartCount})
                        <span className="ml-2 font-semibold">R$ {cartTotal.toFixed(2)}</span>
                      </>
                    ) : (
                      'Carrinho'
                    )}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Search */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="search"
              placeholder="Buscar produtos..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Menu */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500">
                {categories.length === 0 ? (
                  <>
                    <div className="text-6xl mb-4">🍺</div>
                    <p className="text-lg font-medium">Cardápio em breve!</p>
                    <p className="text-sm mt-2">Estamos preparando nossos produtos para você.</p>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-4">🔍</div>
                    <p className="text-lg font-medium">Nenhum produto encontrado</p>
                    <p className="text-sm mt-2">Tente buscar por outro termo.</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            filteredCategories.map((category) => (
              <div key={category.id} className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{category.name}</h2>
                {category.description && (
                  <p className="text-gray-600 mb-4">{category.description}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {category.products.map((product) => {
                    const basePrice = typeof product.base_price === 'string' ? parseFloat(product.base_price) : product.base_price;
                    
                    return (
                      <Card key={product.id} className="overflow-hidden">
                        <CardContent className="p-0">
                          {product.image_url && (
                            <div className="relative aspect-video bg-gray-200">
                              <img
                                src={getFileUrl(product.image_url) || ''}
                                alt={product.name}
                                className="object-cover w-full h-full"
                                onError={() => {}}
                                onLoad={() => {}}
                              />
                            </div>
                          )}
                          <div className="p-4">
                            <h3 className="font-semibold text-lg text-gray-900">{product.name}</h3>
                            {product.description && (
                              <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                            )}
                            <div className="mt-3">
                              <p className="text-lg font-bold text-blue-600">
                                R$ {basePrice.toFixed(2)}
                              </p>
                            </div>
                            
                            {/* Variações */}
                            {product.variants && product.variants.length > 0 ? (
                              <div className="mt-4 space-y-2">
                                {product.variants.map((variant) => {
                                  const modifierPrice = typeof variant.price_modifier === 'string' ? parseFloat(variant.price_modifier) : variant.price_modifier;
                                  const totalPrice = basePrice + modifierPrice;
                                  
                                  return (
                                    <Button
                                      key={variant.id}
                                      variant="outline"
                                      size="sm"
                                      className="w-full justify-between hover:bg-blue-50 hover:border-blue-300"
                                      onClick={() => openQuantityModal(product, variant)}
                                    >
                                      <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center">
                                          {/* {variant.image_url ? (
                                            <img
                                              src={getFileUrl(variant.image_url) || ''}
                                              alt={variant.name}
                                              className="w-8 h-8 object-cover rounded mr-3"
                                              onError={() => {}}
                                              onLoad={() => {}}
                                            />
                                          ) : null} */}
                                          <div className="text-left">
                                            <span className="font-medium">{variant.name}</span>
                                            {variant.volume && variant.unit_type && (
                                              <span className="text-xs text-gray-500 ml-2">
                                                ({variant.volume} - {variant.unit_type})
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <span className="font-semibold text-blue-600">R$ {totalPrice.toFixed(2)}</span>
                                      </div>
                                    </Button>
                                  );
                                })}
                              </div>
                            ) : (
                              <Button
                                className="w-full mt-4"
                                onClick={() => {
                                  // Se não tem variações, criar uma variação padrão
                                  const defaultVariant: Variant = {
                                    id: 'default',
                                    name: 'Padrão',
                                    price_modifier: 0,
                                  };
                                  openQuantityModal(product, defaultVariant);
                                }}
                              >
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Adicionar
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Quantidade */}
      {selectedVariant && (
        <QuantityModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedVariant(null);
          }}
          product={selectedVariant.product}
          variant={selectedVariant.variant}
          basePrice={
            typeof selectedVariant.product.base_price === 'string'
              ? parseFloat(selectedVariant.product.base_price)
              : selectedVariant.product.base_price
          }
          onAddToCart={(quantity) => addToCart(selectedVariant.product, selectedVariant.variant, quantity)}
        />
      )}
    </>
  );
}