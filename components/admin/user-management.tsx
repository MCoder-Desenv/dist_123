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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Key, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  active: boolean;
  created_at: string;
  // password NÃO está mais na interface
}

const ROLES = [
  { value: 'MASTER_DIST', label: 'Master Distribuidora' },
  { value: 'ATENDENTE', label: 'Atendente' },
  { value: 'FINANCEIRO', label: 'Financeiro' },
  { value: 'LEITURA', label: 'Leitura' },
];

export function UserManagement() {
  const { data: session } = useSession() || {};
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Estados para redefinição de senha
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
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
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'ATENDENTE',
    active: true,
  });

  const [formData, setFormData] = useState({
    email: '',
    password: '', // Apenas para criação de novo usuário
    firstName: '',
    lastName: '',
    phone: '',
    role: 'ATENDENTE',
    active: true,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  // Detecta mudanças no formulário comparando com valores iniciais
  useEffect(() => {
    const formChanged = 
      formData.email !== initialFormData.email ||
      formData.firstName !== initialFormData.firstName ||
      formData.lastName !== initialFormData.lastName ||
      formData.phone !== initialFormData.phone ||
      formData.role !== initialFormData.role ||
      formData.active !== initialFormData.active ||
      // Se estiver criando um novo usuário e tiver senha digitada
      (!editingUser && formData.password !== '');

    setHasUnsavedChanges(formChanged);
  }, [formData, initialFormData, editingUser]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const response = await res.json();
        setUsers(response.data || []);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      // Para edição, não enviar senha vazia
      const payload = editingUser 
        ? {
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone,
            role: formData.role,
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
        setConfirmDialogTitle(editingUser ? 'Usuário atualizado!' : 'Usuário criado!');
        setConfirmDialogDescription(
          editingUser
            ? 'As alterações do usuário foram salvas com sucesso.'
            : 'O novo usuário foi adicionado ao sistema com sucesso.'
        );
        setConfirmDialogAction(() => () => {
          setDialogOpen(false);
          resetForm();
          fetchUsers();
        });
        setConfirmDialogOpen(true);
      } else {
        const error = await res.json();
        setConfirmDialogType('error');
        setConfirmDialogTitle('Erro ao salvar usuário');
        setConfirmDialogDescription(error.error || 'Não foi possível salvar o usuário. Tente novamente.');
        setConfirmDialogAction(null);
        setConfirmDialogOpen(true);
      }
    } catch (error) {
      setConfirmDialogType('error');
      setConfirmDialogTitle('Erro inesperado');
      setConfirmDialogDescription('Ocorreu um erro ao salvar o usuário. Verifique sua conexão e tente novamente.');
      setConfirmDialogAction(null);
      setConfirmDialogOpen(true);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    const initialData = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || '',
      role: user.role,
      active: user.active,
    };
    setFormData({
      ...initialData,
      password: '', // Sempre vazio na edição
    });
    setInitialFormData(initialData);
    setHasUnsavedChanges(false);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setConfirmDialogType('error');
    setConfirmDialogTitle('Excluir usuário?');
    setConfirmDialogDescription('Esta ação não pode ser desfeita. O usuário será removido permanentemente do sistema.');
    setConfirmDialogAction(() => async () => {
      try {
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success('Usuário excluído!');
          fetchUsers();
        } else {
          const error = await res.json();
          toast.error(error.error || 'Erro ao excluir usuário');
        }
      } catch (error) {
        toast.error('Erro ao excluir usuário');
      }
    });
    setConfirmDialogOpen(true);
  };

  const handleResetPassword = (user: User) => {
    setResetPasswordUser(user);
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
      const res = await fetch(`/api/users/${resetPasswordUser?.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      if (res.ok) {
        setConfirmDialogType('confirmation');
        setConfirmDialogTitle('Senha redefinida!');
        setConfirmDialogDescription(`A senha do usuário ${resetPasswordUser?.firstName} ${resetPasswordUser?.lastName} foi alterada com sucesso.`);
        setConfirmDialogAction(() => () => {
          setResetPasswordDialogOpen(false);
          setResetPasswordUser(null);
          setNewPassword('');
          setConfirmPassword('');
        });
        setConfirmDialogOpen(true);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Erro ao redefinir senha');
      }
    } catch (error) {
      toast.error('Erro ao redefinir senha');
    }
  };

  const resetForm = () => {
    const emptyData = {
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      role: 'ATENDENTE',
      active: true,
    };
    setFormData({
      ...emptyData,
      password: '',
    });
    setInitialFormData(emptyData);
    setEditingUser(null);
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

  const handleNewUser = () => {
    const emptyData = {
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      role: 'ATENDENTE',
      active: true,
    };
    setFormData({
      ...emptyData,
      password: '',
    });
    setInitialFormData(emptyData);
    setEditingUser(null);
    setHasUnsavedChanges(false);
    setDialogOpen(true);
  };

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
              <CardTitle>Usuários Cadastrados</CardTitle>
              <CardDescription>Gerencie os usuários e suas permissões</CardDescription>
            </div>
            <Button onClick={handleNewUser}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.firstName} {user.lastName}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ROLES.find(r => r.value === user.role)?.label || user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.active ? 'default' : 'secondary'}>
                      {user.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isMasterDist && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleResetPassword(user)}
                          title="Redefinir senha"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                      )}
                      {session?.user?.email !== user.email && (
                        <Button variant="outline" size="sm" onClick={() => handleDelete(user.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Usuário */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Atualize os dados do usuário' : 'Cadastre um novo usuário no sistema'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nome *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Sobrenome *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!editingUser}
                />
              </div>

              {!editingUser && (
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

              {editingUser && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Nota:</strong> Para alterar a senha deste usuário, use o botão de redefinir senha (ícone de chave) na lista de usuários.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Perfil de Acesso *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="active">Usuário ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingUser ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Redefinição de Senha */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {resetPasswordUser?.firstName} {resetPasswordUser?.lastName}
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