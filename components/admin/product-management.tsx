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
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Switch } from '@/components/ui/switch';

interface Category {
  id: string;
  name: string;
}

interface Variant {
  id?: string;
  name: string;
  volume: string;
  sku?: string;
  unit_type: string;
  price_modifier: number;
  price_modifier_display?: string | null;
  stock_quantity: number;
  image_url?: string | null;
  active: boolean;
  // ui-only fields
  localId?: string;
  tempFile?: File | null;
  tempPreview?: string | null;
  removeImagePending?: boolean; // novo: marca a remoção para variações persistidas
}

interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  volume?: string;
  unit_type?: string;
  base_price: number | string;
  image_url?: string | null;
  stock_quantity: number;
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const [blockVariantModalOpen, setBlockVariantModalOpen] = useState(false);

  // ConfirmationDialog (re-used for success/error messages)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogType, setConfirmDialogType] = useState<'confirmation' | 'alert' | 'error'>('alert');
  const [confirmDialogTitle, setConfirmDialogTitle] = useState('');
  const [confirmDialogDescription, setConfirmDialogDescription] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [confirmDialogPrimaryAction, setConfirmDialogPrimaryAction] = useState<(() => void) | null>(null);

  // Unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [initialFormData, setInitialFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    sku: '',
    volume: '',
    unit_type: '',
    base_price: '',
    stock_quantity: '0',
    active: true,
  });

  const [initialVariants, setInitialVariants] = useState<Variant[]>([]);
  const [initialImagePreview, setInitialImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    sku: '',
    volume: '',
    unit_type: '',
    base_price: '',
    stock_quantity: '0',
    active: true,
  });

  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantErrors, setVariantErrors] = useState<Record<string, { name?: boolean }>>({});

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  // Detect unsaved changes (inclui removeImagePending na comparação)
  useEffect(() => {
    const formChanged =
      formData.name !== initialFormData.name ||
      formData.description !== initialFormData.description ||
      formData.category_id !== initialFormData.category_id ||
      formData.sku !== initialFormData.sku ||
      formData.volume !== initialFormData.volume ||
      formData.unit_type !== initialFormData.unit_type ||
      formData.base_price !== initialFormData.base_price ||
      formData.stock_quantity !== initialFormData.stock_quantity ||
      formData.active !== initialFormData.active;

    const imageChanged = imageFile !== null || removeImage;

    const simplified = variants.map(v => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      volume: v.volume,
      unit_type: v.unit_type,
      price_modifier: v.price_modifier,
      stock_quantity: v.stock_quantity,
      image_url: v.image_url,
      active: v.active,
      removeImagePending: v.removeImagePending || false,
    }));
    const simplifiedInitial = initialVariants.map(v => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      volume: v.volume,
      unit_type: v.unit_type,
      price_modifier: v.price_modifier,
      stock_quantity: v.stock_quantity,
      image_url: v.image_url,
      active: v.active,
      removeImagePending: (v as any).removeImagePending || false,
    }));

    const variantsChanged = JSON.stringify(simplified) !== JSON.stringify(simplifiedInitial);

    setHasUnsavedChanges(formChanged || imageChanged || variantsChanged);
  }, [formData, initialFormData, variants, initialVariants, imageFile, removeImage]);

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

  const normalizeKey = (key?: string | null) => {
    if (!key) return null;
    return key.replace(/^\/uploads\//, '').replace(/^\/+/, '');
  };

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

  const makeLocalId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const addEmptyVariantRow = () => {
    const v: Variant = {
      localId: makeLocalId(),
      name: '',
      sku: '',
      volume: '',
      unit_type: '',
      price_modifier: 0,
      price_modifier_display: '',
      stock_quantity: 0,
      image_url: null,
      tempFile: null,
      tempPreview: null,
      active: true,
      removeImagePending: false,
    };
    setVariants(prev => [...prev, v]);
  };

  const removeVariantByLocalId = async (localId?: string) => {
    if (!localId) return;
    const v = variants.find(x => x.localId === localId);
    if (!v) return;
    if (v.image_url && v.image_url.startsWith('products/temp/')) {
      await deleteTempKey(v.image_url);
    }
    setVariants(prev => prev.filter(x => x.localId !== localId));
    setVariantErrors(prev => {
      const copy = { ...prev };
      delete copy[localId];
      return copy;
    });
  };

  // Alterado: marcar remoção para persistidos; remover imediatamente para não-persistidos
  const handleRemoveVariantImage = async (localId?: string) => {
    if (!localId) return;
    const variant = variants.find(v => v.localId === localId);
    if (!variant) return;

    // Limpa o input file associado (se existir)
    const input = document.getElementById(`variant-image-input-${localId}`) as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }

    if (!variant.id) {
      // não persistida -> remove localmente e limpa temp se houver
      if (variant.image_url && variant.image_url.startsWith('products/temp/')) {
        await deleteTempKey(variant.image_url);
      }
      setVariants(prev => prev.map(v => (v.localId === localId ? { ...v, image_url: null, tempFile: null, tempPreview: null, removeImagePending: false } : v)));
      toast.success('Imagem da variação removida localmente');
      return;
    }

    // persistida -> marcar para remoção, não realizar PATCH agora
    setVariants(prev => prev.map(v => (v.localId === localId ? { ...v, tempFile: null, tempPreview: null, removeImagePending: true } : v)));
    toast('Imagem marcada para remoção. Clique em Atualizar para confirmar.', { icon: 'ℹ️' });
  };

  const handleDeleteVariant = (localId?: string) => {
    if (!localId) return;
    const variant = variants.find(v => v.localId === localId);
    if (!variant) return;

    if (!variant.id) {
      removeVariantByLocalId(localId);
      return;
    }

    setConfirmDialogType('error');
    setConfirmDialogTitle('Excluir variação?');
    setConfirmDialogDescription('Esta ação não pode ser desfeita. A variação será removida permanentemente.');
    setConfirmDialogPrimaryAction(null);
    setConfirmDialogAction(() => async () => {
      try {
        const res = await fetch(`/api/admin/product-variants/${variant.id}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          setVariants(prev => prev.filter(x => x.localId !== localId));
          setConfirmDialogOpen(false);
          toast.success('Variação excluída com sucesso');
          fetchProducts();
          return;
        }

        let backendMessage = `Erro ao deletar variação (status ${res.status})`;
        const contentType = res.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          try {
            const body = await res.json();
            backendMessage = body?.error || body?.message || backendMessage;
          } catch (e) {
            const text = await res.text().catch(() => null);
            if (text) backendMessage = text;
          }
        } else {
          const text = await res.text().catch(() => null);
          if (text) backendMessage = text;
        }

        const isConflict = res.status === 409 || /pedido|order|referen/i.test(backendMessage);

        if (isConflict) {
          const variantPatch = await fetch(`/api/admin/product-variants/${variant.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: false }),
          });

          const productId = editingProduct?.id;
          let productPatchOk = true;
          if (productId) {
            const prodRes = await fetch(`/api/admin/products/${productId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ active: false }),
            });
            productPatchOk = prodRes.ok;
            if (!productPatchOk) {
              const txt = await prodRes.text().catch(() => null);
              console.warn('Erro ao desativar produto:', txt);
            }
          }

          if (variantPatch.ok) {
            setVariants(prev => prev.map(v => (v.localId === localId ? { ...v, active: false } : v)));
            if (productId) {
              setProducts(prev => prev.map(p => (p.id === productId ? { ...p, active: false } : p)));
            }

            setConfirmDialogType('confirmation');
            setConfirmDialogTitle('Variação e produto desativados');
            setConfirmDialogDescription(
              'A variação não pôde ser excluída porque existe referência em pedidos. O produto e a variação foram desativados.'
            );
            setConfirmDialogAction(null);
            setConfirmDialogPrimaryAction(() => () => setConfirmDialogOpen(false));
            setConfirmDialogOpen(true);
            return;
          } else {
            const txt = await variantPatch.text().catch(() => null);
            setConfirmDialogType('error');
            setConfirmDialogTitle('Erro ao desativar variação');
            setConfirmDialogDescription(
              `A variação não pôde ser excluída por referência em pedidos. Tentativa de desativação falhou: ${txt || backendMessage}`
            );
            setConfirmDialogAction(null);
            setConfirmDialogPrimaryAction(null);
            setConfirmDialogOpen(true);
            return;
          }
        }

        setConfirmDialogType('error');
        setConfirmDialogTitle('Não foi possível excluir a variação');
        setConfirmDialogDescription(backendMessage);
        setConfirmDialogAction(null);
        setConfirmDialogPrimaryAction(null);
        setConfirmDialogOpen(true);
      } catch (err) {
        console.error('Error deleting variant:', err);
        setConfirmDialogType('error');
        setConfirmDialogTitle('Erro ao excluir variação');
        setConfirmDialogDescription('Ocorreu um erro ao tentar excluir a variação. Verifique sua conexão e tente novamente.');
        setConfirmDialogAction(null);
        setConfirmDialogPrimaryAction(null);
        setConfirmDialogOpen(true);
      }
    });

    setConfirmDialogOpen(true);
  };

  const onVariantChange = (localId: string | undefined, field: keyof Variant, value: any) => {
    if (!localId) return;

    if (field === 'price_modifier') {
      setVariants(prev =>
        prev.map(v => {
          if (v.localId !== localId) return v;
          const raw = String(value || '');
          const digits = raw.replace(/\D/g, '');
          if (digits.length === 0) {
            return { ...v, price_modifier: 0, price_modifier_display: '' };
          }
          const formattedNumber = formatCentsToBRL(digits);
          const display = 'R$ ' + formattedNumber;
          const numeric = Number(parseBRLToNumberString(display));
          return { ...v, price_modifier: isNaN(numeric) ? 0 : numeric, price_modifier_display: display };
        })
      );
      return;
    }

    if (field === 'active') {
      const bool = value === true || value === 'true';
      setVariants(prev =>
        prev.map(v => (v.localId === localId ? { ...v, active: bool } : v))
      );
      return;
    }

    setVariants(prev =>
      prev.map(v => {
        if (v.localId !== localId) return v;
        return {
          ...v,
          [field]: field === 'stock_quantity' ? parseInt(value || '0', 10) || 0 : value,
        } as Variant;
      })
    );

    if (field === 'name' && value) {
      setVariantErrors(prev => {
        const copy = { ...prev };
        if (localId && copy[localId]) {
          delete copy[localId].name;
          if (Object.keys(copy[localId]).length === 0) delete copy[localId];
        }
        return copy;
      });
    }
  };

  const onVariantImageSelect = (localId: string | undefined, file?: File) => {
    if (!localId || !file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const preview = reader.result as string;
      setVariants(prev =>
        prev.map(v => (v.localId === localId ? { ...v, tempFile: file, tempPreview: preview, removeImagePending: false } : v))
      );
    };
    reader.readAsDataURL(file);
  };

  const isVariantEmpty = (v: Variant) => {
    const hasMeaningfulField =
      !!(v.name && v.name.trim()) ||
      !!(v.sku && v.sku.trim()) ||
      !!(v.volume && v.volume.trim()) ||
      !!(v.unit_type && v.unit_type.trim()) ||
      !!(v.tempFile) ||
      !!(v.image_url) ||
      (v.price_modifier && Number(v.price_modifier) !== 0) ||
      (v.stock_quantity && Number(v.stock_quantity) !== 0);
    return !hasMeaningfulField;
  };

  const validateVariantsBeforeSubmit = (variantsToCheck: Variant[]) => {
    const errors: Record<string, { name?: boolean }> = {};
    let valid = true;
    for (const v of variantsToCheck) {
      if (isVariantEmpty(v)) continue;
      if (!v.name || !v.name.trim()) {
        valid = false;
        if (v.localId) errors[v.localId] = { ...(errors[v.localId] || {}), name: true };
      }
    }
    setVariantErrors(errors);
    return valid;
  };

  const formatNumberToBRLString = (value?: number | string | null) => {
    if (value === undefined || value === null || value === '') return '';
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (isNaN(n)) return '';
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatCentsToBRL = (digitsOnly: string) => {
    const centsInt = parseInt(digitsOnly || '0', 10);
    const amount = centsInt / 100;
    return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseBRLToNumberString = (formatted?: string | null) => {
    if (!formatted) return '0';
    let only = String(formatted).replace(/[^0-9,.-]/g, '');
    only = only.replace(/\./g, '');
    only = only.replace(',', '.');
    if (only === '' || only === '.' || only === ',') return '0';
    return only;
  };

  const handleBasePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 0) {
      setFormData(prev => ({ ...prev, base_price: '' }));
      return;
    }
    const formattedNumber = formatCentsToBRL(digits);
    setFormData(prev => ({ ...prev, base_price: 'R$ ' + formattedNumber }));
  };

  const openDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      const initialData = {
        name: product.name,
        description: product.description || '',
        category_id: product.category.id,
        sku: product.sku || '',
        volume: product.volume || '',
        unit_type: product.unit_type || '',
        base_price: formatNumberToBRLString(product.base_price),
        stock_quantity: product.stock_quantity?.toString(),
        active: product.active,
      };
      setFormData(initialData);
      setInitialFormData(initialData);

      const mapped = (product.variants || []).map(v => {
        const preview = v.image_url ? (v.image_url.startsWith('data:') ? v.image_url : `/api/files/${encodeURIComponent(normalizeKey(v.image_url) || '')}`) : null;
        return {
          ...v,
          localId: makeLocalId(),
          tempFile: null,
          tempPreview: preview,
          price_modifier_display: formatNumberToBRLString(v.price_modifier),
          removeImagePending: false,
        } as Variant;
      });
      setVariants(mapped);
      setInitialVariants(mapped.map(v => ({ ...v })));
      setImagePreview(product.image_url || null);
      setInitialImagePreview(product.image_url || null);
    } else {
      setEditingProduct(null);
      const emptyData = {
        name: '',
        description: '',
        category_id: '',
        sku: '',
        volume: '',
        unit_type: '',
        base_price: '',
        stock_quantity: '0',
        active: true,
      };
      setFormData(emptyData);
      setInitialFormData(emptyData);
      setVariants([]);
      setInitialVariants([]);
      setImagePreview(null);
      setInitialImagePreview(null);
    }
    setImageFile(null);
    setRemoveImage(false);
    setVariantErrors({});
    setHasUnsavedChanges(false);
    setDialogOpen(true);
  };

  const closeDialog = async () => {
    const hasTempFiles = variants.some(v => !!v.tempFile);
    // Novo: detectar apenas variações novas (sem id) que contém dados (linhas que o usuário preencheu)
    const hasNewVariantRows = variants.some(v => !v.id && !isVariantEmpty(v));

    // Só considerar bloqueio quando:
    // - há mudanças detectadas (form/variants/image),
    // - ou há imagens temporárias (tempFile),
    // - ou o usuário adicionou variações novas não salvas (sem id com dados).
    if (hasUnsavedChanges || hasTempFiles || hasNewVariantRows) {
      setConfirmDialogType('alert');
      setConfirmDialogTitle('Descartar alterações?');
      setConfirmDialogDescription(
        hasTempFiles
          ? 'Você tem imagens temporárias/alterações. Tem certeza que deseja sair sem salvar?'
          : hasNewVariantRows
            ? 'Você adicionou variações não salvas. Tem certeza que deseja sair sem salvar?'
            : 'Você tem alterações não salvas. Tem certeza que deseja sair sem salvar?'
      );
      setConfirmDialogPrimaryAction(null);
      setConfirmDialogAction(() => async () => {
        await Promise.all(variants.map(v => deleteTempKey(v.image_url)));
        setVariantErrors({});
        setVariants([]);
        setDialogOpen(false);
        setEditingProduct(null);
        setImageFile(null);
        setImagePreview(null);
        setRemoveImage(false);
        setHasUnsavedChanges(false);
      });
      setConfirmDialogOpen(true);
      return;
    }

    await Promise.all(variants.map(v => deleteTempKey(v.image_url)));
    setDialogOpen(false);
    setEditingProduct(null);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
    setVariants([]);
    setHasUnsavedChanges(false);
  };

  const handleVariantImageInput = (localId: string) => {
    const input = document.getElementById(`variant-image-input-${localId}`) as HTMLInputElement | null;
    input?.click();
  };

  const handleVariantImageChange = (e: React.ChangeEvent<HTMLInputElement>, localId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Salva referência ao input para limpar depois
    const input = e.currentTarget as HTMLInputElement;
    onVariantImageSelect(localId, file);
    // limpa o input para permitir re-seleção do mesmo arquivo
    input.value = '';
  };

  // Submit product + variants (respeita removeImagePending)
  const submitProduct = async () => {
    if (!formData.name || !formData.category_id || !formData.base_price) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const variantsToConsider = variants.filter(v => !isVariantEmpty(v));
    const valid = validateVariantsBeforeSubmit(variantsToConsider);
    if (!valid) {
      toast.error('Preencha os campos obrigatórios nas variações (campo Nome).');
      return;
    }

    const variantsToSend: any[] = [];

    for (const v of variantsToConsider) {
      let image_url = v.image_url ?? null;

      // If the variant was marked for removal, ensure image_url === null (no upload)
      if (v.removeImagePending) {
        image_url = null;
      } else if (v.tempFile) {
        // upload new file
        const form = new FormData();
        form.append('file', v.tempFile);
        try {
          const res = await fetch('/api/upload/variant', {
            method: 'POST',
            body: form,
            credentials: 'include',
          });
          if (res.ok) {
            const json = await res.json();
            image_url = json?.data?.file_key;
          } else {
            const err = await res.json().catch(() => null);
            setConfirmDialogType('error');
            setConfirmDialogDescription(err?.error || 'Erro ao enviar imagem da variação');
            setConfirmDialogAction(null);
            setConfirmDialogPrimaryAction(null);
            setConfirmDialogTitle('Erro ao enviar imagem da variação');
            setConfirmDialogOpen(true);
            return;
          }
        } catch (err) {
          console.error('Erro upload imagem variação:', err);
          setConfirmDialogType('error');
          setConfirmDialogTitle('Erro ao enviar imagem da variação');
          setConfirmDialogDescription('Erro de conexão ao enviar imagem da variação. Tente novamente.');
          setConfirmDialogAction(null);
          setConfirmDialogPrimaryAction(null);
          setConfirmDialogOpen(true);
          return;
        }
      }

      variantsToSend.push({
        id: v.id || undefined,
        name: v.name,
        sku: v.sku || null,
        volume: v.volume || null,
        unit_type: v.unit_type || null,
        price_modifier: v.price_modifier ?? 0,
        stock_quantity: v.stock_quantity ?? 0,
        image_url: image_url,
        active: v.active !== false,
      });
    }

    const submitData = new FormData();
    submitData.append('name', formData.name);
    submitData.append('description', formData.description);
    submitData.append('category_id', formData.category_id);
    submitData.append('sku', formData.sku);
    submitData.append('volume', formData.volume);
    submitData.append('unit_type', formData.unit_type);

    const normalizedBasePrice = parseBRLToNumberString(formData.base_price);
    submitData.append('base_price', normalizedBasePrice);

    submitData.append('stock_quantity', formData.stock_quantity);
    submitData.append('active', formData.active.toString());
    submitData.append('variants', JSON.stringify(variantsToSend));

    if (imageFile) {
      submitData.append('image', imageFile);
    }

    if (removeImage) {
      submitData.append('remove_image', 'true');
    }

    try {
      const url = editingProduct ? `/api/admin/products/${editingProduct.id}` : '/api/admin/products';

      const res = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        body: submitData,
      });

      if (res.ok) {
        setConfirmDialogType('confirmation');
        setConfirmDialogTitle(editingProduct ? 'Produto atualizado!' : 'Produto criado!');
        setConfirmDialogDescription(
          editingProduct
            ? 'As alterações do produto foram salvas com sucesso.'
            : 'O novo produto foi adicionado ao catálogo com sucesso.'
        );

        setConfirmDialogAction(null);
        setConfirmDialogPrimaryAction(() => () => {
          setDialogOpen(false);
          setEditingProduct(null);
          setImageFile(null);
          setImagePreview(null);
          setRemoveImage(false);
          setVariants([]);
          setHasUnsavedChanges(false);
          fetchProducts();
        });

        setConfirmDialogOpen(true);
      } else {
        const error = await res.json().catch(() => ({ error: 'Erro ao salvar produto' }));
        setConfirmDialogType('error');
        setConfirmDialogTitle('Erro ao salvar produto');
        setConfirmDialogDescription(error.error || 'Não foi possível salvar o produto. Tente novamente.');
        setConfirmDialogAction(null);
        setConfirmDialogPrimaryAction(null);
        setConfirmDialogOpen(true);
      }
    } catch (error) {
      console.error('Error saving product:', error);
      setConfirmDialogType('error');
      setConfirmDialogTitle('Erro inesperado');
      setConfirmDialogDescription('Ocorreu um erro ao salvar o produto. Verifique sua conexão e tente novamente.');
      setConfirmDialogAction(null);
      setConfirmDialogPrimaryAction(null);
      setConfirmDialogOpen(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitProduct();
  };

  const handleDelete = async (id: string) => {
    setConfirmDialogType('error');
    setConfirmDialogTitle('Excluir produto?');
    setConfirmDialogDescription(
      'Esta ação não pode ser desfeita. O produto será removido permanentemente do catálogo.'
    );

    setConfirmDialogPrimaryAction(null);
    setConfirmDialogAction(() => async () => {
      try {
        const res = await fetch(`/api/admin/products/${id}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          setConfirmDialogOpen(false);
          toast.success('Produto deletado!');
          fetchProducts();
          return;
        }

        let backendMessage = `Erro ao deletar produto (status ${res.status})`;
        const contentType = res.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          try {
            const body = await res.json();
            backendMessage = body?.error || body?.message || backendMessage;
          } catch (e) {
            const text = await res.text().catch(() => null);
            if (text) backendMessage = text;
          }
        } else {
          const text = await res.text().catch(() => null);
          if (text) backendMessage = text;
        }

        setConfirmDialogType('error');
        setConfirmDialogTitle('Não foi possível excluir o produto');
        setConfirmDialogDescription(backendMessage);
        setConfirmDialogAction(null);
        setConfirmDialogPrimaryAction(null);
        setConfirmDialogOpen(true);
      } catch (error) {
        console.error('Error deleting product:', error);
        setConfirmDialogType('error');
        setConfirmDialogTitle('Erro ao deletar produto');
        setConfirmDialogDescription('Ocorreu um erro ao tentar excluir o produto. Verifique a conexão e tente novamente.');
        setConfirmDialogAction(null);
        setConfirmDialogPrimaryAction(null);
        setConfirmDialogOpen(true);
      }
    });

    setConfirmDialogOpen(true);
  };

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

  const variantsExist = variants.length > 0;

  const handleToggleProductActive = async (productId: string, current: boolean) => {
    setProducts(prev => prev.map(p => (p.id === productId ? { ...p, active: !current } : p)));
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !current }),
      });
      if (!res.ok) {
        setProducts(prev => prev.map(p => (p.id === productId ? { ...p, active: current } : p)));
        const err = await res.json().catch(() => null);
        setConfirmDialogType('error');
        setConfirmDialogTitle('Erro ao atualizar produto');
        setConfirmDialogDescription(err?.error || 'Erro ao atualizar status do produto');
        setConfirmDialogAction(null);
        setConfirmDialogPrimaryAction(null);
        setConfirmDialogOpen(true);
      } else {
        setConfirmDialogType('confirmation');
        setConfirmDialogTitle('Produto atualizado');
        setConfirmDialogDescription('Status atualizado com sucesso.');
        setConfirmDialogAction(null);
        setConfirmDialogPrimaryAction(() => () => setConfirmDialogOpen(false));
        setConfirmDialogOpen(true);
      }
    } catch (err) {
      console.error('Error toggling product active:', err);
      setProducts(prev => prev.map(p => (p.id === productId ? { ...p, active: current } : p)));
      setConfirmDialogType('error');
      setConfirmDialogTitle('Erro ao atualizar produto');
      setConfirmDialogDescription('Erro ao atualizar status do produto. Tente novamente.');
      setConfirmDialogAction(null);
      setConfirmDialogPrimaryAction(null);
      setConfirmDialogOpen(true);
    }
  };

  const handleToggleVariantActive = async (
    localId: string,
    variantId?: string,
    current: boolean = false
  ) => {
    if (!variantId) {
      setVariants(prev => prev.map(v => (v.localId === localId ? { ...v, active: !current } : v)));
      setConfirmDialogType('confirmation');
      setConfirmDialogTitle('Variação atualizada');
      setConfirmDialogDescription('Status da variação atualizado (localmente).');
      setConfirmDialogAction(null);
      setConfirmDialogPrimaryAction(() => () => setConfirmDialogOpen(false));
      setConfirmDialogOpen(true);
      return;
    }

    setVariants(prev => prev.map(v => (v.localId === localId ? { ...v, active: !current } : v)));
    try {
      const res = await fetch(`/api/admin/product-variants/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !current }),
      });
      if (!res.ok) {
        setVariants(prev => prev.map(v => (v.localId === localId ? { ...v, active: current } : v)));
        const err = await res.json().catch(() => null);
        setConfirmDialogType('error');
        setConfirmDialogTitle('Erro ao atualizar variação');
        setConfirmDialogDescription(err?.error || 'Erro ao atualizar status da variação');
        setConfirmDialogAction(null);
        setConfirmDialogPrimaryAction(null);
        setConfirmDialogOpen(true);
      } else {
        setConfirmDialogType('confirmation');
        setConfirmDialogTitle('Variação atualizada');
        setConfirmDialogDescription('Status da variação atualizado com sucesso.');
        setConfirmDialogAction(null);
        setConfirmDialogPrimaryAction(() => () => setConfirmDialogOpen(false));
        setConfirmDialogOpen(true);
      }
    } catch (err) {
      console.error('Error toggling variant active:', err);
      setVariants(prev => prev.map(v => (v.localId === localId ? { ...v, active: current } : v)));
      setConfirmDialogType('error');
      setConfirmDialogTitle('Erro ao atualizar variação');
      setConfirmDialogDescription('Erro ao atualizar status da variação. Tente novamente.');
      setConfirmDialogAction(null);
      setConfirmDialogPrimaryAction(null);
      setConfirmDialogOpen(true);
    }
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
            <div className="space-y-6">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-start gap-6 p-6 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => openDialog(product)}
                >
                  {product.image_url ? (
                    <div className="relative w-32 h-32 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={`/api/files/${encodeURIComponent(normalizeKey(product.image_url) || '')}`}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 flex-shrink-0 bg-gray-100 rounded-lg flex items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-gray-400" />
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-xl">{product.name}</h3>
                        <p className="text-sm text-gray-600">{product.category.name}</p>
                        {product.description && (
                          <p className="text-sm text-gray-500 mt-1">{product.description}</p>
                        )}
                        <p className="text-xl font-bold text-blue-600 mt-2">
                          R$ {typeof product.base_price === 'string' ? parseFloat(product.base_price).toFixed(2) : product.base_price.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Estoque: {product.stock_quantity} {product.unit_type ? ' - ' + product.unit_type : ''} {product.volume ? ' - ' + product.volume : ''}
                        </p>

                        {(!product.variants || product.variants.length === 0) ? (
                          <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-sm text-gray-700">Status:</span>
                            <Switch
                              checked={product.active}
                              onCheckedChange={() => handleToggleProductActive(product.id, product.active)}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 mt-2">
                            Status: {product.active ? 'Ativo' : 'Inativo'}
                          </p>
                        )}

                        {product.variants && product.variants.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {product.variants.map((variant, idx) => {
                              const modifier = typeof variant.price_modifier === 'string'
                                ? parseFloat(variant.price_modifier)
                                : variant.price_modifier;
                              return (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded"
                                >
                                  {variant.name} (+R$ {modifier.toFixed(2)}) • Estoque: {variant.stock_quantity}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDialog(product);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(product.id);
                          }}
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
        if (!open) {
          closeDialog();
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
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
                  type="text"
                  step="0.01"
                  value={formData.base_price}
                  onChange={handleBasePriceChange}
                  placeholder="R$ 0,00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock_quantity">Estoque do Produto *</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  placeholder="0"
                  required
                  disabled={variantsExist}
                />
                {!variantsExist ? (
                  <p className="text-xs text-gray-500">
                    Estoque do produto principal (sem variante)
                  </p>
                ) : (
                  <p className="text-xs text-orange-600">
                    Estoque do produto base está desabilitado porque existem variações. Remova as variações para habilitar este campo.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="product_volume">Volume do Produto</Label>
                <Input
                  id="product_volume"
                  value={formData.volume}
                  onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                  placeholder="Ex: 350ml, 1L, 2L"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product_unit_type">Tipo de Unidade do Produto</Label>
                <Input
                  id="product_unit_type"
                  value={formData.unit_type}
                  onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                  placeholder="Ex: unidade, caixa, litros"
                />
              </div>

              <div className="space-y-2 flex items-end">
                <div className="flex items-center gap-3">
                  <Label className="cursor-pointer">Status</Label>
                  <Switch
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: !!checked })}
                  />
                </div>
              </div>
            </div>

            {/* Variações - header with + */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Variações do Produto</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Adicione diferentes tamanhos, embalagens ou apresentações do produto
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" onClick={addEmptyVariantRow} variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Linha
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-600">
                  <div className="col-span-3">Nome da Variação *</div>
                  <div className="col-span-2">SKU</div>
                  <div className="col-span-1">Volume</div>
                  <div className="col-span-1">Tipo</div>
                  <div className="col-span-1">Preço Adicional</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Estoque</div>
                  <div className="col-span-1">Excluir</div> {/* lixeira na linha "acima" */}
                  <div className="col-span-2">Imagem / Ações</div>
                </div>

                {/* Variants rows */}
                <div className="space-y-2 mt-2">
                  {variants.map((variant) => {
                    const localId = variant.localId!;
                    const err = variantErrors[localId];
                    const showPreview = !variant.removeImagePending && (variant.tempPreview || variant.image_url);
                    return (
                      <div key={localId} className="grid grid-cols-12 gap-2 items-start p-2 bg-gray-50 rounded">
                        {/* Name */}
                        <div className="col-span-3">
                          <Input
                            placeholder="Ex: 1.5L - Unidade"
                            value={variant.name}
                            onChange={(e) => onVariantChange(localId, 'name', e.target.value)}
                            className={err?.name ? 'border-red-500' : ''}
                          />
                        </div>

                        {/* SKU */}
                        <div className="col-span-2">
                          <Input
                            placeholder="Ex: AQC-500"
                            value={variant.sku || ''}
                            onChange={(e) => onVariantChange(localId, 'sku', e.target.value)}
                          />
                        </div>

                        {/* Volume */}
                        <div className="col-span-1">
                          <Input
                            placeholder="1.5"
                            value={variant.volume}
                            onChange={(e) => onVariantChange(localId, 'volume', e.target.value)}
                          />
                        </div>

                        {/* Unit type */}
                        <div className="col-span-1">
                          <Input
                            placeholder="Litros"
                            value={variant.unit_type}
                            onChange={(e) => onVariantChange(localId, 'unit_type', e.target.value)}
                          />
                        </div>

                        {/* Price modifier */}
                        <div className="col-span-1">
                          <Input
                            type="text"
                            placeholder="R$ 0,00"
                            value={variant.price_modifier_display ?? formatNumberToBRLString(variant.price_modifier)}
                            onChange={(e) => onVariantChange(localId, 'price_modifier', e.target.value)}
                          />
                        </div>

                        {/* Status */}
                        <div className="col-span-1 flex items-center justify-center">
                          <Switch
                            checked={!!variant.active}
                            onCheckedChange={() => handleToggleVariantActive(localId, variant.id, variant.active)}
                          />
                        </div>

                        {/* Stock */}
                        <div className="col-span-1">
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={String(variant.stock_quantity ?? 0)}
                            onChange={(e) => onVariantChange(localId, 'stock_quantity', e.target.value)}
                          />
                        </div>

                        {/* Delete (lixeira) - linha "acima" */}
                        <div className="col-span-1 flex items-center justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => (variant.id ? handleDeleteVariant(localId) : removeVariantByLocalId(localId))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Image / buttons (preview e botões juntos em linha) */}
                        <div className="col-span-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                              {showPreview ? (
                                variant.tempPreview ? (
                                  <img src={variant.tempPreview} alt={variant.name} className="w-full h-full object-cover" />
                                ) : variant.image_url ? (
                                  <img
                                    src={`/api/files/${encodeURIComponent(normalizeKey(variant.image_url) || '')}`}
                                    alt={variant.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="h-5 w-5 text-gray-400" />
                                )
                              ) : (
                                <ImageIcon className="h-5 w-5 text-gray-400" />
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                id={`variant-image-input-${localId}`}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleVariantImageChange(e, localId)}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleVariantImageInput(localId)}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Imagem
                              </Button>

                              <Button
                                type="button"
                                variant={(variant.image_url || variant.tempPreview) && !variant.removeImagePending ? 'destructive' : 'ghost'}
                                size="sm"
                                onClick={() => handleRemoveVariantImage(localId)}
                                disabled={!(variant.tempPreview || variant.image_url)}
                              >
                                Remover Imagem
                              </Button>
                            </div>
                          </div>

                          {/* se marcado para remoção, mostrar badge abaixo */}
                          {variant.removeImagePending && (
                            <div className="text-xs text-orange-600 mt-2">Imagem marcada para remoção (será removida ao atualizar)</div>
                          )}
                        </div>

                        {/* Inline error hint */}
                        {err?.name && (
                          <div className="col-span-12">
                            <p className="text-sm text-red-600">Nome da variação é obrigatório</p>
                          </div>
                        )}

                        {!variant.active && !err?.name && (
                          <div className="col-span-12">
                            <p className="text-sm text-gray-500">Desativada</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2 text-sm text-red-600">
                <p>Observação: linhas vazias não serão enviadas. Preencha o campo "Nome da Variação" para que ela seja considerada.</p>
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

      <Dialog open={blockVariantModalOpen} onOpenChange={setBlockVariantModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atenção</DialogTitle>
            <DialogDescription>
              Se for adicionar variações de produtos, retire a quantidade no nível do produto.
              Ao remover, o campo ficará bloqueado e você poderá adicionar a variação.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setBlockVariantModalOpen(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        type={confirmDialogType}
        title={confirmDialogTitle}
        description={confirmDialogDescription}
        buttons={
          confirmDialogAction
            ? [
                {
                  label: 'Cancelar',
                  onClick: () => setConfirmDialogOpen(false),
                  variant: 'outline',
                },
                {
                  label: confirmDialogType === 'error' ? 'Excluir' : 'Confirmar',
                  onClick: () => {
                    try {
                      confirmDialogAction && confirmDialogAction();
                    } finally {
                      setConfirmDialogPrimaryAction(null);
                    }
                  },
                  variant: confirmDialogType === 'error' ? 'destructive' : 'default',
                },
              ]
            : [
                {
                  label: 'OK',
                  onClick: () => {
                    try {
                      if (confirmDialogPrimaryAction) {
                        confirmDialogPrimaryAction();
                        setConfirmDialogPrimaryAction(null);
                      }
                    } finally {
                      setConfirmDialogOpen(false);
                    }
                  },
                  variant: 'outline',
                },
              ]
        }
      />
    </>
  );
}