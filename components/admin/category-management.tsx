'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface Category {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  sort_order: number;
  active: boolean;
  _count?: { products: number };
}

export function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Estados para o ConfirmationDialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogType, setConfirmDialogType] = useState<'confirmation' | 'alert' | 'error'>('alert');
  const [confirmDialogTitle, setConfirmDialogTitle] = useState('');
  const [confirmDialogDescription, setConfirmDialogDescription] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);

  // Estado para controlar mudanças não salvas
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Valores iniciais para comparação
  const [initialFormData, setInitialFormData] = useState({
    name: '',
    description: '',
    sort_order: 0,
    active: true,
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sort_order: 0,
    active: true,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  // Detecta mudanças no formulário comparando com valores iniciais
  useEffect(() => {
    const formChanged = 
      formData.name !== initialFormData.name ||
      formData.description !== initialFormData.description ||
      formData.sort_order !== initialFormData.sort_order ||
      formData.active !== initialFormData.active;

    setHasUnsavedChanges(formChanged);
  }, [formData, initialFormData]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const response = await res.json();
        setCategories(response.data || []);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toast.error('Erro ao carregar categorias');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingCategory ? `/api/categories/${editingCategory.id}` : '/api/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setConfirmDialogType('confirmation');
        setConfirmDialogTitle(editingCategory ? 'Categoria atualizada!' : 'Categoria criada!');
        setConfirmDialogDescription(
          editingCategory
            ? 'As alterações da categoria foram salvas com sucesso.'
            : 'A nova categoria foi adicionada com sucesso.'
        );
        setConfirmDialogAction(() => () => {
          setDialogOpen(false);
          resetForm();
          fetchCategories();
        });
        setConfirmDialogOpen(true);
      } else {
        const error = await res.json();
        setConfirmDialogType('error');
        setConfirmDialogTitle('Erro ao salvar categoria');
        setConfirmDialogDescription(error.message || 'Não foi possível salvar a categoria. Tente novamente.');
        setConfirmDialogAction(null);
        setConfirmDialogOpen(true);
      }
    } catch (error) {
      setConfirmDialogType('error');
      setConfirmDialogTitle('Erro inesperado');
      setConfirmDialogDescription('Ocorreu um erro ao salvar a categoria. Verifique sua conexão e tente novamente.');
      setConfirmDialogAction(null);
      setConfirmDialogOpen(true);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    const initialData = {
      name: category.name,
      description: category.description || '',
      sort_order: category.sort_order,
      active: category.active,
    };
    setFormData(initialData);
    setInitialFormData(initialData);
    setHasUnsavedChanges(false);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setConfirmDialogType('error');
    setConfirmDialogTitle('Excluir categoria?');
    setConfirmDialogDescription('Esta ação não pode ser desfeita. A categoria será removida permanentemente.');
    setConfirmDialogAction(() => async () => {
      try {
        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success('Categoria excluída!');
          fetchCategories();
        } else {
          const error = await res.json();
          toast.error(error.message || 'Erro ao excluir categoria');
        }
      } catch (error) {
        toast.error('Erro ao excluir categoria');
      }
    });
    setConfirmDialogOpen(true);
  };

  const resetForm = () => {
    const emptyData = {
      name: '',
      description: '',
      sort_order: 0,
      active: true,
    };
    setFormData(emptyData);
    setInitialFormData(emptyData);
    setEditingCategory(null);
    setHasUnsavedChanges(false);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && hasUnsavedChanges) {
      setConfirmDialogType('alert');
      setConfirmDialogTitle('Descartar alterações?');
      setConfirmDialogDescription('Você tem alterações não salvas. Tem certeza que deseja sair sem salvar?');
      setConfirmDialogAction(() => () => {
        setDialogOpen(false);
        resetForm();
      });
      setConfirmDialogOpen(true);
      return;
    }
    
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleNewCategory = () => {
    const emptyData = {
      name: '',
      description: '',
      sort_order: 0,
      active: true,
    };
    setFormData(emptyData);
    setInitialFormData(emptyData);
    setEditingCategory(null);
    setHasUnsavedChanges(false);
    setDialogOpen(true);
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Categorias de Produtos</CardTitle>
              <CardDescription>Organize seus produtos em categorias</CardDescription>
            </div>
            <Button onClick={handleNewCategory}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Categoria
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Produtos</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {category.description || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{category._count?.products || 0}</Badge>
                  </TableCell>
                  <TableCell>{category.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={category.active ? 'default' : 'secondary'}>
                      {category.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(category)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(category.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Atualize os dados da categoria' : 'Cadastre uma nova categoria de produtos'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Categoria *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort_order">Ordem de Exibição</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="active">Categoria ativa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingCategory ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ConfirmationDialog */}
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
                  onClick: () => {},
                  variant: 'outline',
                },
                {
                  label: confirmDialogType === 'error' ? 'Excluir' : 'Confirmar',
                  onClick: confirmDialogAction,
                  variant: confirmDialogType === 'error' ? 'destructive' : 'default',
                },
              ]
            : [
                {
                  label: 'Fechar',
                  onClick: () => {},
                  variant: 'outline',
                },
              ]
        }
      />
    </>
  );
}