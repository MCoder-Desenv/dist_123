'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, UserX, Search, Key, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Switch } from '@/components/ui/switch';

interface Customer {
  id: string;
  email: string;
  name: string;
  cnpj_cpf: string; // ✅ Adicionar cnpj_cpf
  phone?: string;
  active: boolean;
  created_at: string;
  _count?: {
    orders: number;
  };
  // password NÃO está na interface
}

export function CustomerManagement() {
  const { data: session } = useSession() || {};
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para redefinição de senha
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordCustomer, setResetPasswordCustomer] = useState<Customer | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estados para o ConfirmationDialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogType, setConfirmDialogType] = useState<'confirmation' | 'alert' | 'error'>('alert');
  const [confirmDialogTitle, setConfirmDialogTitle] = useState('');
  const [confirmDialogDescription, setConfirmDialogDescription] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);

  // Estado para controlar mudanças não salvas
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Valores iniciais para comparação (SEM senha)
  const [initialFormData, setInitialFormData] = useState({
    name: '',
    email: '',
    cnpj_cpf: '', // ✅ Adicionar cnpj_cpf
    phone: '',
    active: true,
  });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cnpj_cpf: '', // ✅ Adicionar cnpj_cpf
    phone: '',
    password: '', // Apenas para criação de novo cliente
    active: true,
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Detecta mudanças no formulário comparando com valores iniciais
  useEffect(() => {
    const formChanged = 
      formData.name !== initialFormData.name ||
      formData.email !== initialFormData.email ||
      formData.cnpj_cpf !== initialFormData.cnpj_cpf || // ✅ Incluir cnpj_cpf
      formData.phone !== initialFormData.phone ||
      formData.active !== initialFormData.active ||
      // Se estiver criando um novo cliente e tiver senha digitada
      (!editingCustomer && formData.password !== '');
    
    setHasUnsavedChanges(formChanged);
  }, [formData, initialFormData, editingCustomer]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const response = await res.json();
        setCustomers(response.data || []);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';

      // Para edição, não enviar senha
      const payload = editingCustomer 
        ? {
            name: formData.name,
            email: formData.email,
            cnpj_cpf: formData.cnpj_cpf, // ✅ Incluir cnpj_cpf
            phone: formData.phone,
            active: formData.active,
          }
        : formData; // Para criação, enviar tudo incluindo senha

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setConfirmDialogType('confirmation');
        setConfirmDialogTitle(editingCustomer ? 'Cliente atualizado!' : 'Cliente criado!');
        setConfirmDialogDescription(
          editingCustomer
            ? 'As alterações do cliente foram salvas com sucesso.'
            : 'O novo cliente foi adicionado com sucesso.'
        );
        setConfirmDialogAction(() => () => {
          setDialogOpen(false);
          resetForm();
          fetchCustomers();
        });
        setConfirmDialogOpen(true);
      } else {
        const error = await res.json();
        setConfirmDialogType('error');
        setConfirmDialogTitle('Erro ao salvar cliente');
        setConfirmDialogDescription(error.error || error.message || 'Não foi possível salvar o cliente. Tente novamente.');
        setConfirmDialogAction(null);
        setConfirmDialogOpen(true);
      }
    } catch (error) {
      setConfirmDialogType('error');
      setConfirmDialogTitle('Erro inesperado');
      setConfirmDialogDescription('Ocorreu um erro ao salvar o cliente. Verifique sua conexão e tente novamente.');
      setConfirmDialogAction(null);
      setConfirmDialogOpen(true);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    const initialData = {
      name: customer.name,
      email: customer.email,
      cnpj_cpf: customer.cnpj_cpf, // ✅ Incluir cnpj_cpf
      phone: customer.phone || '',
      active: customer.active,
    };
    setFormData({
      ...initialData,
      password: '', // Sempre vazio na edição
    });
    setInitialFormData(initialData);
    setHasUnsavedChanges(false);
    setDialogOpen(true);
  };

  const handleToggleActive = async (customer: Customer) => {
    const newActiveState = !customer.active;
    
    setConfirmDialogType(newActiveState ? 'confirmation' : 'alert');
    setConfirmDialogTitle(newActiveState ? 'Ativar cliente?' : 'Desativar cliente?');
    setConfirmDialogDescription(
      newActiveState
        ? `O cliente ${customer.name} será reativado e poderá fazer login novamente.`
        : `O cliente ${customer.name} será desativado e não poderá mais fazer login no sistema.`
    );
    setConfirmDialogAction(() => async () => {
      try {
        const res = await fetch(`/api/customers/${customer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customer.name,
            email: customer.email,
            cnpj_cpf: customer.cnpj_cpf, // ✅ Incluir cnpj_cpf
            phone: customer.phone,
            active: newActiveState,
          }),
        });

        if (res.ok) {
          toast.success(newActiveState ? 'Cliente ativado!' : 'Cliente desativado!');
          fetchCustomers();
        } else {
          const error = await res.json();
          toast.error(error.error || error.message || 'Erro ao atualizar status do cliente');
        }
      } catch (error) {
        toast.error('Erro ao atualizar status do cliente');
      }
    });
    setConfirmDialogOpen(true);
  };

  const handleResetPassword = (customer: Customer) => {
    setResetPasswordCustomer(customer);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setResetPasswordDialogOpen(true);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    try {
      const res = await fetch(`/api/customers/${resetPasswordCustomer?.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      if (res.ok) {
        setConfirmDialogType('confirmation');
        setConfirmDialogTitle('Senha redefinida!');
        setConfirmDialogDescription(`A senha do cliente ${resetPasswordCustomer?.name} foi alterada com sucesso.`);
        setConfirmDialogAction(() => () => {
          setResetPasswordDialogOpen(false);
          setResetPasswordCustomer(null);
          setNewPassword('');
          setConfirmPassword('');
        });
        setConfirmDialogOpen(true);
      } else {
        const error = await res.json();
        toast.error(error.error || error.message || 'Erro ao redefinir senha');
      }
    } catch (error) {
      toast.error('Erro ao redefinir senha');
    }
  };

  const resetForm = () => {
    const emptyData = {
      name: '',
      email: '',
      cnpj_cpf: '', // ✅ Incluir cnpj_cpf
      phone: '',
      active: true,
    };
    setFormData({
      ...emptyData,
      password: '',
    });
    setInitialFormData(emptyData);
    setEditingCustomer(null);
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

  const handleNewCustomer = () => {
    const emptyData = {
      name: '',
      email: '',
      cnpj_cpf: '', // ✅ Incluir cnpj_cpf
      phone: '',
      active: true,
    };
    setFormData({
      ...emptyData,
      password: '',
    });
    setInitialFormData(emptyData);
    setEditingCustomer(null);
    setHasUnsavedChanges(false);
    setDialogOpen(true);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.cnpj_cpf.includes(searchTerm) // ✅ Buscar por cnpj_cpf também
  );

  const isMasterDist = session?.user?.role === 'MASTER_DIST';

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Clientes Cadastrados</CardTitle>
              <CardDescription>Gerencie os clientes da sua distribuidora</CardDescription>
            </div>
            <Button onClick={handleNewCustomer}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou CPF/CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF/CNPJ</TableHead> {/* ✅ Adicionar coluna */}
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data de Cadastro</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.cnpj_cpf}</TableCell> {/* ✅ Exibir cnpj_cpf */}
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{customer.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={customer.active ? 'default' : 'secondary'}>
                        {customer.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(customer.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {isMasterDist && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleEdit(customer)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleResetPassword(customer)}
                              title="Redefinir senha"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleToggleActive(customer)}
                              title={customer.active ? 'Desativar cliente' : 'Ativar cliente'}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {!isMasterDist && (
                          <Badge variant="secondary">Sem permissão</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Cliente */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            <DialogDescription>
              {editingCustomer ? 'Atualize os dados do cliente' : 'Cadastre um novo cliente'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {/* ✅ Campo CPF/CNPJ */}
              <div className="space-y-2">
                <Label htmlFor="cnpj_cpf">CPF/CNPJ *</Label>
                <Input
                  id="cnpj_cpf"
                  value={formData.cnpj_cpf}
                  onChange={(e) => setFormData({ ...formData, cnpj_cpf: e.target.value })}
                  required
                  disabled={!!editingCustomer} // Não permitir edição
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              {!editingCustomer && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}

              {editingCustomer && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Nota:</strong> Para alterar a senha deste cliente, use o botão de redefinir senha (ícone de chave) na lista de clientes.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>

              {/* Switch de ativo/inativo */}
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="active" className="cursor-pointer">Cliente ativo</Label>
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingCustomer ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Redefinição de Senha */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha do Cliente</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {resetPasswordCustomer?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPasswordSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha *</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Redigite a senha"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </Button>
                </div>
              </div>

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-red-600">As senhas não coincidem</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword}>
                Redefinir Senha
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
                  label: 'Confirmar',
                  onClick: confirmDialogAction,
                  variant: confirmDialogType === 'alert' ? 'destructive' : 'default',
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