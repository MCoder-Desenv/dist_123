'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Search, Building2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { QuantityModal } from './quantity-modal';
import { useAuth } from '@/context/AuthContext';

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
  unit_type?: string;
  volume?: string;
  base_price: number | string;
  image_url?: string;
  variants?: Variant[];
  // quantidade no nível do produto (opcional)
  stock_quantity?: number;
}

interface Variant {
  id: string;
  name: string;
  volume?: string;
  unit_type?: string;
  price_modifier: number | string;
  image_url?: string;
  // quantidade da variação
  stock_quantity?: number;
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Agora guardamos múltiplas mensagens para o alerta de estoque
  const [stockAlertOpen, setStockAlertOpen] = useState(false);
  const [stockAlertMessages, setStockAlertMessages] = useState<string[]>([]);

  const { user, loading: authLoading } = useAuth();
  const isLogged = !!user;
  const checkingAuth = authLoading;

  useEffect(() => {
    fetchMenu();
    loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchMenu = async () => {
    try {
      const res = await fetch(`/api/public/menu/${slug}`);
      if (res.ok) {
        const response = await res.json();
        if (response.success && response.data) {
          const rawCategories: Category[] = response.data.categories || [];

          // Filtrar produtos/variantes com estoque <= 0
          const filtered = rawCategories
            .map((cat) => {
              const filteredProducts = (cat.products || [])
                .map((p) => {
                  const variants = (p.variants || []).filter(
                    (v) => Number(v.stock_quantity ?? 0) > 0
                  );

                  const productHasStock = Number(p.stock_quantity ?? 0) > 0;
                  // Retorna somente produtos que têm estoque no nível do produto
                  // ou que possuam pelo menos uma variação disponível
                  if (!productHasStock && variants.length === 0) {
                    return null;
                  }

                  return {
                    ...p,
                    variants,
                  } as Product;
                })
                .filter(Boolean) as Product[];

              return {
                ...cat,
                products: filteredProducts,
              } as Category;
            })
            .filter((c) => (c.products || []).length > 0);

          setCategories(filtered);
        } else {
          setCategories([]);
        }
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error('Error fetching menu:', error);
      toast.error('Erro ao carregar cardápio');
      setCategories([]);
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

  const openProductModal = (product: Product) => {
    // segurança: não abrir modal se produto não tiver estoque nem variações
    const productHasStock = Number(product.stock_quantity ?? 0) > 0;
    const hasAvailableVariants = (product.variants || []).some((v) => Number(v.stock_quantity ?? 0) > 0);

    if (!productHasStock && !hasAvailableVariants) {
      // não deveria acontecer porque já filtramos, mas tratamos por segurança
      setStockAlertMessages([`Este PRODUTO '${product.name}' não está disponível no momento.`]);
      setStockAlertOpen(true);
      return;
    }

    setSelectedProduct(product);
    setModalOpen(true);
  };

  // Helper: display name combinando produto + variação (se existir)
  const displayName = (product: Product, variant: Variant | null) => {
    if (!variant) return product.name;
    return `${product.name} - ${variant.name}`;
  };

  // items: array de { product, variant|null, quantity }
  const addToCart = (items: Array<{ product: Product; variant: Variant | null; quantity: number }>) => {
    try {
      const cart: any[] = JSON.parse(localStorage.getItem(`cart_${company.id}`) || '[]');

      // Agregar por chave productId::variantId para somar múltiplas adições na mesma chamada
      type AggEntry = {
        product: Product;
        variant: Variant | null;
        availableStock: number;
        existingQty: number; // já no carrinho
        requestedQty: number; // somatória nesta chamada
      };

      const aggMap = new Map<string, AggEntry>();

      // Preenche existingQty a partir do cart
      const getExistingFromCart = (productId: string, variantId: string | null) => {
        const found = cart.find(
          (c: any) =>
            c.product_id === productId &&
            ((variantId && c.variant_id === variantId) || (!variantId && !c.variant_id))
        );
        return found ? Number(found.quantity || 0) : 0;
      };

      // Agregar requested quantities
      for (const it of items) {
        const { product, variant, quantity } = it;
        if (!product || !quantity || quantity <= 0) continue;

        const key = `${product.id}::${variant?.id ?? 'null'}`;
        const existingInCart = getExistingFromCart(product.id, variant?.id ?? null);
        const availableStock = variant ? Number(variant.stock_quantity ?? 0) : Number(product.stock_quantity ?? 0);

        if (!aggMap.has(key)) {
          aggMap.set(key, {
            product,
            variant,
            availableStock,
            existingQty: existingInCart,
            requestedQty: quantity,
          });
        } else {
          const e = aggMap.get(key)!;
          e.requestedQty += quantity;
        }
      }

      // Verifica violações e coleta mensagens
      const violations: string[] = [];
      for (const [, entry] of aggMap.entries()) {
        const { product, variant, availableStock, existingQty, requestedQty } = entry;
        const totalWanted = existingQty + requestedQty;
        if (availableStock <= 0) {
          violations.push(`Só tem 0 deste PRODUTO: ${displayName(product, variant)}.`);
        } else if (totalWanted > availableStock) {
          violations.push(`Só tem ${availableStock} deste PRODUTO: ${displayName(product, variant)}.`);
        }
      }

      if (violations.length > 0) {
        setStockAlertMessages(violations);
        setStockAlertOpen(true);
        return;
      }

      // Se passou nas validações, adiciona ao carrinho
      for (const { product, variant, quantity } of items) {
        if (!product || !quantity || quantity <= 0) continue;

        const basePrice = typeof product.base_price === 'string' ? parseFloat(product.base_price) : product.base_price;

        if (variant) {
          // Produto com variante
          const modifierPrice = typeof variant.price_modifier === 'string' ? parseFloat(variant.price_modifier) : variant.price_modifier;
          const price = (isNaN(Number(basePrice)) ? 0 : Number(basePrice)) + (isNaN(Number(modifierPrice)) ? 0 : Number(modifierPrice));

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
        } else {
          // Produto sem variante
          const base = isNaN(Number(basePrice)) ? 0 : Number(basePrice);
          const existingIndex = cart.findIndex(
            (item: any) => item.product_id === product.id && !item.variant_id
          );

          if (existingIndex >= 0) {
            cart[existingIndex].quantity += quantity;
          } else {
            cart.push({
              product_id: product.id,
              product_name: product.name,
              variant_id: null,
              variant_name: null,
              unit_price: base,
              quantity: quantity,
            });
          }
        }
      }

      localStorage.setItem(`cart_${company.id}`, JSON.stringify(cart));
      loadCart();

      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
      toast.success(`${totalItems} ${totalItems === 1 ? 'item adicionado' : 'itens adicionados'} ao carrinho!`);
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Erro ao adicionar ao carrinho');
    }
  };

  // Função melhorada de filtro que busca em categorias, produtos e variantes (aplica sobre o estado já filtrado)
  const filteredCategories = categories
    .map((cat) => {
      const searchLower = searchTerm.trim().toLowerCase();

      // Se não há termo, retorna a categoria inteira (já filtrada por estoque)
      if (!searchLower) return cat;

      const categoryMatches =
        cat.name.toLowerCase().includes(searchLower) ||
        (cat.description || '').toLowerCase().includes(searchLower);

      const filteredProducts = (cat.products || []).filter((p) => {
        const productMatches =
          p.name.toLowerCase().includes(searchLower) ||
          (p.description || '').toLowerCase().includes(searchLower) ||
          (p.unit_type || '').toLowerCase().includes(searchLower) ||
          (p.volume || '').toLowerCase().includes(searchLower);

        const variantMatches = (p.variants || []).some((v) => {
          return (
            v.name.toLowerCase().includes(searchLower) ||
            (v.volume || '').toLowerCase().includes(searchLower) ||
            (v.unit_type || '').toLowerCase().includes(searchLower)
          );
        });

        return categoryMatches || productMatches || variantMatches;
      });

      return {
        ...cat,
        products: filteredProducts,
      };
    })
    .filter((cat) => (cat.products || []).length > 0);

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
              placeholder="Buscar categorias e produtos..."
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
                    // base price (number)
                    let basePriceNum = typeof product.base_price === 'string' ? parseFloat(product.base_price) : Number(product.base_price ?? 0);
                    if (isNaN(basePriceNum)) basePriceNum = 0;

                    const hasVariants = product.variants && product.variants.length > 0;

                    // Calcula menor preço entre variações (basePrice + modifier)
                    let minVariantPrice = Infinity;
                    if (product.variants && product.variants.length > 0) {
                      for (const v of product.variants) {
                        const modifier = typeof v.price_modifier === 'string' ? parseFloat(v.price_modifier) : Number(v.price_modifier ?? 0);
                        const modNum = isNaN(modifier) ? 0 : modifier;
                        const variantPrice = basePriceNum + modNum;
                        if (!isNaN(variantPrice) && variantPrice < minVariantPrice) {
                          minVariantPrice = variantPrice;
                        }
                      }
                    }

                    // Decide qual preço exibir:
                    // - Se tem variantes e basePrice é zero/ausente -> usa minVariantPrice
                    // - Caso contrário, usa basePriceNum
                    let displayPrice = basePriceNum;
                    if (hasVariants && (!basePriceNum || basePriceNum === 0)) {
                      displayPrice = minVariantPrice === Infinity ? 0 : minVariantPrice;
                    }

                    return (
                      <Card 
                        key={product.id} 
                        className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => openProductModal(product)}
                      >
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
                            <h3 className="font-semibold text-lg text-gray-900">
                              {product.name}
                              {product.unit_type && (
                                <span className="font-semibold text-lg text-gray-900"> - {product.unit_type}</span>
                              )}
                            </h3>
                            {product.description && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                            )}
                            <div className="mt-3 flex items-center justify-between">
                              <p className="text-lg font-bold text-blue-600">
                                {hasVariants ? 'A partir de ' : ''}R$ {Number(displayPrice || 0).toFixed(2)}
                              </p>
                              {hasVariants && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  {product?.variants?.length} {product?.variants?.length === 1 ? 'opção' : 'opções'}
                                </span>
                              )}
                            </div>
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

      {/* Modal de Produto (QuantityModal externo) */}
      {selectedProduct && (
        <QuantityModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          onAddToCart={addToCart}
        />
      )}

      {/* Modal simples para alertas de estoque (usa a mensagem com "PRODUTO") */}
      {stockAlertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 mx-4">
            <h3 className="text-lg font-semibold mb-2">Quantidade indisponível</h3>
            <div className="text-sm text-gray-700 mb-4 space-y-2">
              {stockAlertMessages.map((m, i) => (
                <p key={i}>{m}</p>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStockAlertOpen(false)}>OK</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}