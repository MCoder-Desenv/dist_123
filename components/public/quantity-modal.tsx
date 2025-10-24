'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Minus, Plus, ShoppingCart, X } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  volume?: string;
  unit_type?: string;
  description?: string;
  image_url?: string;
  base_price: number | string;
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

interface QuantityModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  onAddToCart: (items: Array<{ product: Product; variant: Variant | null; quantity: number }>) => void;
}

// Função auxiliar para obter URL de arquivo
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

export function QuantityModal({
  open,
  onClose,
  product,
  onAddToCart,
}: QuantityModalProps) {
  const hasVariants = product.variants && product.variants.length > 0;
  
  // Estado para produto sem variante
  const [productQuantity, setProductQuantity] = useState(1);
  
  // Estado para variantes (mapa de variant.id -> quantidade)
  const [variantQuantities, setVariantQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) {
      setProductQuantity(1);
      setVariantQuantities({});
    }
  }, [open]);

  const basePrice = typeof product.base_price === 'string' 
    ? parseFloat(product.base_price) 
    : product.base_price;

  // Handlers para produto sem variante
  const handleProductIncrement = () => {
    setProductQuantity((prev) => prev + 1);
  };

  const handleProductDecrement = () => {
    if (productQuantity > 1) {
      setProductQuantity((prev) => prev - 1);
    }
  };

  // Handlers para variantes
  const handleVariantIncrement = (variantId: string) => {
    setVariantQuantities((prev) => ({
      ...prev,
      [variantId]: (prev[variantId] || 0) + 1,
    }));
  };

  const handleVariantDecrement = (variantId: string) => {
    setVariantQuantities((prev) => {
      const current = prev[variantId] || 0;
      if (current > 0) {
        return {
          ...prev,
          [variantId]: current - 1,
        };
      }
      return prev;
    });
  };

  const handleAddToCart = () => {
    if (hasVariants) {
      // Adicionar variantes selecionadas
      const items = product.variants!
        .filter(variant => (variantQuantities[variant.id] || 0) > 0)
        .map(variant => ({
          product,
          variant,
          quantity: variantQuantities[variant.id],
        }));
      
      if (items.length === 0) {
        return; // Nenhuma variante selecionada
      }
      
      onAddToCart(items);
    } else {
      // Adicionar produto sem variante
      onAddToCart([{
        product,
        variant: null,
        quantity: productQuantity,
      }]);
    }
    onClose();
  };

  // Calcular total
  const calculateTotal = () => {
    if (hasVariants) {
      return product.variants!.reduce((sum, variant) => {
        const quantity = variantQuantities[variant.id] || 0;
        const modifierPrice = typeof variant.price_modifier === 'string' 
          ? parseFloat(variant.price_modifier) 
          : variant.price_modifier;
        const variantPrice = basePrice + modifierPrice;
        return sum + (variantPrice * quantity);
      }, 0);
    } else {
      return basePrice * productQuantity;
    }
  };

  const totalPrice = calculateTotal();
  const totalItems = hasVariants 
    ? Object.values(variantQuantities).reduce((sum, qty) => sum + qty, 0)
    : productQuantity;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{product.name}</DialogTitle>
          {product.description && (
            <DialogDescription className="text-base">
              {product.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Imagem e informações do produto */}
          <div className="flex items-start gap-4">
            {product.image_url && (
              <div className="relative w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={getFileUrl(product.image_url) || ''}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              {!hasVariants && (
                <>
                  <p className="text-2xl font-bold text-blue-600">
                    R$ {basePrice.toFixed(2)}
                  </p>
                  {(product.volume || product.unit_type) && (
                    <p className="text-sm text-gray-500 mt-1">
                      {[product.volume, product.unit_type].filter(Boolean).join(' - ')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Produto SEM variantes - controle de quantidade direto */}
          {!hasVariants && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Quantidade</label>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleProductDecrement}
                  disabled={productQuantity <= 1}
                  className="h-10 w-10"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                
                <div className="flex-1 text-center">
                  <span className="text-2xl font-bold text-gray-900">{productQuantity}</span>
                </div>
                
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleProductIncrement}
                  className="h-10 w-10"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Produto COM variantes - lista de variantes */}
          {hasVariants && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Escolha as opções ({product.variants!.length} disponíveis)
              </label>
              
              {product.variants!.map((variant) => {
                const modifierPrice = typeof variant.price_modifier === 'string' 
                  ? parseFloat(variant.price_modifier) 
                  : variant.price_modifier;
                const variantPrice = basePrice + modifierPrice;
                const quantity = variantQuantities[variant.id] || 0;

                return (
                  <div 
                    key={variant.id} 
                    className="border rounded-lg p-3 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Imagem da variante */}
                      {variant.image_url ? (
                        <div className="relative w-16 h-16 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                          <img
                            src={getFileUrl(variant.image_url) || ''}
                            alt={variant.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 flex-shrink-0 bg-gray-200 rounded flex items-center justify-center">
                          <span className="text-2xl">📦</span>
                        </div>
                      )}

                      {/* Informações da variante */}
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{variant.name}</h4>
                        {(variant.volume || variant.unit_type) && (
                          <p className="text-xs text-gray-500">
                            {[variant.volume, variant.unit_type].filter(Boolean).join(' - ')}
                          </p>
                        )}
                        <p className="text-lg font-bold text-blue-600 mt-1">
                          R$ {variantPrice.toFixed(2)}
                        </p>
                      </div>

                      {/* Controles de quantidade */}
                      <div className="flex items-center gap-2">
                        {quantity === 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleVariantIncrement(variant.id)}
                            className="h-8 px-3"
                          >
                            Adicionar
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleVariantDecrement(variant.id)}
                              className="h-8 w-8"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            
                            <span className="text-lg font-bold text-gray-900 min-w-[2rem] text-center">
                              {quantity}
                            </span>
                            
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleVariantIncrement(variant.id)}
                              className="h-8 w-8"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Total */}
          {totalPrice > 0 && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-600">Total</span>
                  {hasVariants && totalItems > 0 && (
                    <span className="text-sm text-gray-500 ml-2">
                      ({totalItems} {totalItems === 1 ? 'item' : 'itens'})
                    </span>
                  )}
                </div>
                <span className="text-2xl font-bold text-gray-900">
                  R$ {totalPrice.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button 
            onClick={handleAddToCart} 
            className="w-full" 
            size="lg"
            disabled={totalItems === 0}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            Adicionar ao Carrinho
            {totalPrice > 0 && (
              <span className="ml-2">• R$ {totalPrice.toFixed(2)}</span>
            )}
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}