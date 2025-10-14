'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Minus, Plus, ShoppingCart } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
}

interface Variant {
  id: string;
  name: string;
  volume?: string;
  unit_type?: string;
  price_modifier: number | string;
}

interface QuantityModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  variant: Variant;
  basePrice: number;
  onAddToCart: (quantity: number) => void;
}

export function QuantityModal({
  open,
  onClose,
  product,
  variant,
  basePrice,
  onAddToCart,
}: QuantityModalProps) {
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (open) {
      setQuantity(1);
    }
  }, [open]);

  const modifierPrice = typeof variant.price_modifier === 'string'
    ? parseFloat(variant.price_modifier)
    : variant.price_modifier;

  const unitPrice = basePrice + modifierPrice;
  const totalPrice = unitPrice * quantity;

  const handleIncrement = () => {
    setQuantity((prev) => prev + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  const handleAddToCart = () => {
    onAddToCart(quantity);
    onClose();
  };

  // Consideramos "não ter variante" quando o id for 'default' (ou vazio)
  const hasVariant = Boolean(variant && variant.id && variant.id !== 'default');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {/* Mantemos o nome do produto no título do diálogo */}
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>
            {product.description || 'Selecione a quantidade desejada'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Produto e (opcionalmente) Variação */}
          <div className="flex items-start gap-4">
            {product.image_url && (
              <div className="relative w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                {/* Se quiser, substitua por getFileUrl para tratamento de encoding */}
                <img
                  src={`/api/public-files/${product.image_url}`}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              {/* Removido o título repetido do produto aqui */}
              
              {/* Só mostramos os detalhes da variação se houver uma variação real */}
              {hasVariant && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{variant.name}</span>
                  {(variant.volume && variant.unit_type) ? (
                    <> — {variant.volume} {variant.unit_type}</>
                  ) : null}
                </p>
              )}

              <p className="text-lg font-bold text-blue-600 mt-1">
                R$ {unitPrice.toFixed(2)} <span className="text-sm font-normal text-gray-500">/ unidade</span>
              </p>
            </div>
          </div>

          {/* Controle de Quantidade */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Quantidade</label>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleDecrement}
                disabled={quantity <= 1}
                className="h-12 w-12"
              >
                <Minus className="h-5 w-5" />
              </Button>
              
              <div className="flex-1 text-center">
                <span className="text-3xl font-bold text-gray-900">{quantity}</span>
              </div>
              
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleIncrement}
                className="h-12 w-12"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Subtotal:</span>
              <span className="text-2xl font-bold text-gray-900">
                R$ {totalPrice.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button onClick={handleAddToCart} className="w-full" size="lg">
            <ShoppingCart className="mr-2 h-5 w-5" />
            Adicionar ao Carrinho
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}