'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
}

interface Variant {
  id?: string;
  name: string;
  volume: string;
  unit_type: string;
  price_modifier: number;
  stock_quantity: number;
  image_url?: string; // armazena a "key" do arquivo (ex: products/temp/xxx.jpg ou products/{id}/variants/xxx.jpg)
  active: boolean;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  base_price: number | string;
  image_url?: string; // armazena a "key" do arquivo (ex: products/{id}/image.jpg)
  active: boolean;
  category: Category;
  variants: Variant[];
}

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null); // pode ser data:... ou chave (products/...)
  const [removeImage, setRemoveImage] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    sku: '',
    base_price: '',
    active: true,
  });

  // Estados para controle de variantes - agora com estado separado para cada variante
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantForm, setVariantForm] = useState({
    name: '',
    volume: '',
    unit_type: '',
    price_modifier: '0',
    stock_quantity: '0',
  });
  // Estados para controle de imagem por variante
  const [variantImageFile, setVariantImageFile] = useState<File | null>(null);
  const [variantImagePreview, setVariantImagePreview] = useState<string | null>(null); // data url para preview local
  const [variantUploading, setVariantUploading] = useState(false);

  // Estado para controle de rascunho de variante
  const [hasDraftVariant, setHasDraftVariant] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/admin/products');
      if (res.ok) {
        const response = await res.json();
        setProducts(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const response = await res.json();
        setCategories(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setRemoveImage(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  };

  const handleAddVariant = async () => {
    if (!variantForm.name.trim()) {
      toast.error('Informe o nome da variação');
      return;
    }

    let variantImageKey: string | undefined;

    // Upload da imagem da variante se existir
    if (variantImageFile) {
      setVariantUploading(true);
      const form = new FormData();
      form.append('file', variantImageFile);

      try {
        const res = await fetch('/api/upload/variant', {
          method: 'POST',
          body: form,
          credentials: 'include', // garante envio de cookies/sessão
        });

        if (res.ok) {
          const json = await res.json();
          variantImageKey = json?.data?.file_key;
        } else {
          const err = await res.json().catch(() => null);
          toast.error(err?.error || 'Erro ao enviar imagem');
          setVariantUploading(false);
          return;
        }
      } catch (error) {
        console.error('Upload variant error:', error);
        toast.error('Erro ao fazer upload da imagem da variante');
        setVariantUploading(false);
        return;
      } finally {
        setVariantUploading(false);
      }
    }

    // Adiciona a nova variante à lista
    const newVariant: Variant = {
      name: variantForm.name,
      volume: variantForm.volume,
      unit_type: variantForm.unit_type,
      price_modifier: parseFloat(variantForm.price_modifier) || 0,
      stock_quantity: parseInt(variantForm.stock_quantity) || 0,
      image_url: variantImageKey, // armazena a chave retornada pelo backend
      active: true,
    };

    setVariants([...variants, newVariant]);

    // Reset apenas os campos do formulário de variação
    setVariantForm({
      name: '',
      volume: '',
      unit_type: '',
      price_modifier: '0',
      stock_quantity: '0',
    });

    // Reset da imagem da variante após adicionar
    setVariantImageFile(null);
    setVariantImagePreview(null);
    setHasDraftVariant(false);
  };

  const handleVariantImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVariantImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setVariantImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setHasDraftVariant(true);
    }
  };

  const removeVariantImage = () => {
    setVariantImageFile(null);
    setVariantImagePreview(null);
    // Verifica se ainda há dados no formulário de variação
    if (!variantForm.name && !variantForm.volume && !variantForm.unit_type) {
      setHasDraftVariant(false);
    }
  };

  const handleRemoveVariant = async (index: number) => {
    const removed = variants[index];
    setVariants(variants.filter((_, i) => i !== index));
    if (removed?.image_url && removed.image_url.startsWith('products/temp/')) {
      await deleteTempKey(removed.image_url);
    }
  };

  const openDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        category_id: product.category.id,
        sku: product.sku || '',
        base_price: product.base_price.toString(),
        active: product.active,
      });
      setVariants(product.variants || []);
      // product.image_url deve conter a chave (ex: products/123/image.jpg) ou null
      setImagePreview(product.image_url || null);
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        category_id: '',
        sku: '',
        base_price: '',
        active: true,
      });
      setVariants([]);
      setImagePreview(null);
    }
    setImageFile(null);
    setRemoveImage(false);
    setHasDraftVariant(false);
    setDialogOpen(true);
  };

  const closeDialog = async () => {
    // Verifica se há variação em rascunho antes de fechar
    const hasVariantData = variantForm.name || variantForm.volume || variantForm.unit_type || variantImageFile;
    if (hasVariantData) {
      if (!confirm('Você tem uma variação em rascunho. Tem certeza que deseja sair sem salvar?')) {
        return;
      } else {
        // Limpa o rascunho se o usuário confirmar a saída
        setVariantForm({
          name: '',
          volume: '',
          unit_type: '',
          price_modifier: '0',
          stock_quantity: '0',
        });
        setVariantImageFile(null);
        setVariantImagePreview(null);
        setHasDraftVariant(false);
      }
    }
    
    // apagar temporários não salvos
    await Promise.all(variants.map(v => deleteTempKey(v.image_url)));
    setDialogOpen(false);
    setEditingProduct(null);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
    setVariants([]);
    setHasDraftVariant(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verifica se há variação em rascunho
    const hasVariantData = variantForm.name || variantForm.volume || variantForm.unit_type || variantImageFile;
    if (hasVariantData) {
      if (!confirm('Você tem uma variação em rascunho. Deseja atualizar esse produto com essa variação que inseriu?')) {
        // Usuário cancelou, limpa o rascunho
        setVariantForm({
          name: '',
          volume: '',
          unit_type: '',
          price_modifier: '0',
          stock_quantity: '0',
        });
        setVariantImageFile(null);
        setVariantImagePreview(null);
        setHasDraftVariant(false);
        return;
      } else {
        // Usuário confirmou, adiciona a variação antes de salvar
        await handleAddVariant();
      }
    }

    if (!formData.name || !formData.category_id || !formData.base_price) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const submitData = new FormData();
    submitData.append('name', formData.name);
    submitData.append('description', formData.description);
    submitData.append('category_id', formData.category_id);
    submitData.append('sku', formData.sku);
    submitData.append('base_price', formData.base_price);
    submitData.append('active', formData.active.toString());
    // variants podem conter image_url que são chaves temporárias (products/temp/...)
    submitData.append('variants', JSON.stringify(variants));

    if (imageFile) {
      submitData.append('image', imageFile);
    }

    if (removeImage) {
      submitData.append('remove_image', 'true');
    }

    try {
      const url = editingProduct
        ? `/api/admin/products/${editingProduct.id}`
        : '/api/admin/products';

      const res = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        body: submitData,
      });

      if (res.ok) {
        toast.success(
          editingProduct ? 'Produto atualizado!' : 'Produto criado!'
        );
        closeDialog();
        fetchProducts();
      } else {
        const error = await res.json().catch(() => ({ error: 'Erro ao salvar produto' }));
        toast.error(error.error || 'Erro ao salvar produto');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Erro ao salvar produto');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente deletar este produto?')) return;

    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Produto deletado!');
        fetchProducts();
      } else {
        toast.error('Erro ao deletar produto');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Erro ao deletar produto');
    }
  };

  const normalizeKey = (key?: string | null) => {
    if (!key) return null;
    // remove leading "/uploads/" ou "/" caso exista
    return key.replace(/^\/uploads\//, '').replace(/^\/+/, '');
  };

  // function normalizeKey(key?: string|null) {
  //   if (!key) return null;
  //   const parts = key.split('/').filter(Boolean); // remove '' vazios
  //   return parts.join('/');
  // }

  async function deleteTempKey(key?: string | null) {
    if (!key || !key.startsWith('products/temp/')) return;
    try {
      await fetch('/api/upload', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
    } catch (err) {
      console.warn('Erro ao deletar temp key', key, err);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Carregando produtos...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCurrentImageUrl = () => {
    if (imagePreview && !removeImage) {
      if (imagePreview.startsWith('data:')) {
        return imagePreview;
      }
      const key = normalizeKey(imagePreview);
      return key ? `/api/files/${encodeURIComponent(key)}` : null;
    }
    return null;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestão de Produtos</CardTitle>
              <CardDescription>Gerencie o catálogo completo de produtos com fotos e variações</CardDescription>
            </div>
            <Button onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium mb-2">Nenhum produto cadastrado</p>
              <p className="text-sm">Clique em "Novo Produto" para começar.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50"
                >
                  {product.image_url ? (
                    <div className="relative w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={`/api/files/${encodeURIComponent(normalizeKey(product.image_url) || '')}`}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-gray-400" />
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{product.name}</h3>
                        <p className="text-sm text-gray-600">{product.category.name}</p>
                        {product.description && (
                          <p className="text-sm text-gray-500 mt-1">{product.description}</p>
                        )}
                        <p className="text-lg font-bold text-blue-600 mt-2">
                          R$ {typeof product.base_price === 'string' ? parseFloat(product.base_price).toFixed(2) : product.base_price.toFixed(2)}
                        </p>
                        {product.variants && product.variants.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {product.variants.map((variant, idx) => {
                              const modifier = typeof variant.price_modifier === 'string'
                                ? parseFloat(variant.price_modifier)
                                : variant.price_modifier;
                              return (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded"
                                >
                                  {variant.name} (+R$ {modifier.toFixed(2)})
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDialog(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
            // Impede o fechamento do diálogo ao clicar fora se houver variação em rascunho
            const hasVariantData = variantForm.name || variantForm.volume || variantForm.unit_type || variantImageFile;
            if (!open && hasVariantData) {
              if (!confirm('Você tem uma variação em rascunho. Tem certeza que deseja sair sem salvar?')) {
                return;
              } else {
                // Limpa o rascunho se o usuário confirmar a saída
                setVariantForm({
                  name: '',
                  volume: '',
                  unit_type: '',
                  price_modifier: '0',
                  stock_quantity: '0',
                });
                setVariantImageFile(null);
                setVariantImagePreview(null);
                setHasDraftVariant(false);
              }
            }
            setDialogOpen(open);
          }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do produto, adicione uma foto e configure as variações
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Imagem */}
            <div className="space-y-2">
              <Label>Foto do Produto</Label>
              {getCurrentImageUrl() ? (
                <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={getCurrentImageUrl()!}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="product-image"
                  />
                  <label htmlFor="product-image" className="cursor-pointer">
                    <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Clique para selecionar uma imagem</p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG até 5MB</p>
                  </label>
                </div>
              )}
            </div>

            {/* Dados básicos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name">Nome do Produto *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Água Crystal"
                  required
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do produto"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU/Código</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Ex: AQC-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="base_price">Preço Base *</Label>
                <Input
                  id="base_price"
                  type="number"
                  step="0.01"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2 flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm font-medium">Produto ativo</span>
                </label>
              </div>
            </div>

            {/* Variações */}
            <div className="space-y-4 border-t pt-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Variações do Produto</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Adicione diferentes tamanhos, embalagens ou apresentações do produto
                </p>
              </div>

              {variants.length > 0 && (
                <div className="space-y-2 mb-4">
                  {variants.map((variant, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {/* Se quiser mostrar miniatura da variação (quando existir image_url), use /api/files/:key */}
                        {variant.image_url ? (
                          <div className="w-12 h-12 rounded overflow-hidden bg-gray-100">
                            <img
                              src={`/api/files/${encodeURIComponent(normalizeKey(variant.image_url) || '')}`}
                              alt={variant.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : null}
                        <div>
                          <p className="font-medium">{variant.name}</p>
                          <p className="text-sm text-gray-600">
                            {variant.volume} - {variant.unit_type} | +R$ {(typeof variant.price_modifier === 'string' ? parseFloat(variant.price_modifier) : variant.price_modifier).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveVariant(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-5 gap-2">
                <Input
                  placeholder="Nome (ex: 1.5L - Unidade)"
                  value={variantForm.name}
                  onChange={(e) => {
                    setVariantForm({ ...variantForm, name: e.target.value });
                    setHasDraftVariant(!!e.target.value || !!variantForm.volume || !!variantForm.unit_type || !!variantImageFile);
                  }}
                  className="col-span-2"
                />
                <Input
                  placeholder="Volume"
                  value={variantForm.volume}
                  onChange={(e) => {
                    setVariantForm({ ...variantForm, volume: e.target.value });
                    setHasDraftVariant(!!variantForm.name || !!e.target.value || !!variantForm.unit_type || !!variantImageFile);
                  }}
                />
                <Input
                  placeholder="Tipo"
                  value={variantForm.unit_type}
                  onChange={(e) => {
                    setVariantForm({ ...variantForm, unit_type: e.target.value });
                    setHasDraftVariant(!!variantForm.name || !!variantForm.volume || !!e.target.value || !!variantImageFile);
                  }}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Preço +"
                  value={variantForm.price_modifier}
                  onChange={(e) => setVariantForm({ ...variantForm, price_modifier: e.target.value })}
                />
              </div>

              {/* Upload de Imagem da Variante */}
              <div>
                <Label>Imagem da Variante (Opcional)</Label>
                <div className="mt-2">
                  {variantImagePreview ? (
                    <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                      <img
                        src={variantImagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1"
                        onClick={removeVariantImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleVariantImageSelect}
                        className="hidden"
                        id="variant-image-input"
                      />
                      <label htmlFor="variant-image-input">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <span>
                            <Upload className="mr-2 h-4 w-4" />
                            Selecionar Imagem
                          </span>
                        </Button>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddVariant}
                  className="flex-1"
                  disabled={variantUploading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {variantUploading ? 'Enviando...' : 'Adicionar Variação'}
                </Button>
                
                {hasDraftVariant && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setVariantForm({
                        name: '',
                        volume: '',
                        unit_type: '',
                        price_modifier: '0',
                        stock_quantity: '0',
                      });
                      setVariantImageFile(null);
                      setVariantImagePreview(null);
                      setHasDraftVariant(false);
                    }}
                    className="flex-1"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir Rascunho
                  </Button>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingProduct ? 'Atualizar' : 'Criar'} Produto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}