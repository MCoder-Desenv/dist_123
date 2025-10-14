'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Pencil, Trash2, Upload, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Company {
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
  active: boolean;
  created_at: string;
  _count?: {
    users: number;
  };
}

interface MasterUser {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  password: string;
}

export function CompanyManagement() {
  const { data: session } = useSession() || {};
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    cnpj_cpf: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    logo_url: '',
    active: true,
  });

  const [masterUserData, setMasterUserData] = useState<MasterUser>({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    password: '',
  });

  const [viewingCompanyUsers, setViewingCompanyUsers] = useState<string | null>(null);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);

  // Estados para CRUD de MASTER_DIST
  const [masterUserDialogOpen, setMasterUserDialogOpen] = useState(false);
  const [editingMasterUser, setEditingMasterUser] = useState<any | null>(null);

  const [masterUserFormData, setMasterUserFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    password: '',
    active: true,
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      if (res.ok) {
        const response = await res.json();
        setCompanies(response.data || []);
      } else {
        setCompanies([]);
      }
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
      toast.error('Erro ao carregar empresas');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploading) {
      toast.error('Aguarde o upload da logo terminar');
      return;
    }

    if (formData.logo_url?.startsWith('blob:')) {
      toast.error('Aguarde o upload da logo terminar');
      return;
    }

    try {
      const url = editingCompany ? `/api/companies/${editingCompany.id}` : '/api/companies';
      const method = editingCompany ? 'PUT' : 'POST';

      // NOTA: quando criar empresa, enviar somente os dados da empresa (sem master_user)
      const payload = formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingCompany ? 'Empresa atualizada!' : 'Empresa criada!');
        setDialogOpen(false);
        resetForm();
        fetchCompanies();
        // opcional: abrir automaticamente a lista de usuários para essa nova empresa
        // const data = await res.json();
        // handleViewUsers(data.data.id);
      } else {
        const error = await res.json();
        toast.error(error.message || 'Erro ao salvar empresa');
      }
    } catch (error) {
      toast.error('Erro ao salvar empresa');
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      slug: company.slug,
      cnpj_cpf: company.cnpj_cpf || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      zip_code: company.zip_code || '',
      logo_url: company.logo_url || '',
      active: company.active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta empresa?')) return;

    try {
      const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Empresa excluída!');
        fetchCompanies();
      } else {
        toast.error('Erro ao excluir empresa');
      }
    } catch (error) {
      toast.error('Erro ao excluir empresa');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!editingCompany) {
      toast.error('Por favor, salve a empresa primeiro antes de fazer upload da logo');
      return;
    }

    // Preview imediato
    const tmpUrl = URL.createObjectURL(file);
    setFormData(prev => ({ ...prev, logo_url: tmpUrl }));

    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('company_id', editingCompany.id);

    setUploading(true);
    try {
      const res = await fetch('/api/upload/logo', {
        method: 'POST',
        body: uploadFormData,
      });

      if (res.ok) {
        const response = await res.json();
        const logoUrl = response.data?.logo_url;
        if (logoUrl) {
          setFormData(prev => ({ ...prev, logo_url: logoUrl }));
          toast.success('Logo enviada!');
        } else {
          toast.error('Erro ao carregar logo');
        }
      } else {
        const error = await res.json();
        toast.error(error.error || 'Erro ao enviar logo');
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      toast.error('Erro ao enviar logo');
    } finally {
      setUploading(false);
      // Limpar URL temporário após 1 segundo
      setTimeout(() => URL.revokeObjectURL(tmpUrl), 1000);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      cnpj_cpf: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      logo_url: '',
      active: true,
    });
    setMasterUserData({
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      password: '',
    });
    setEditingCompany(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleViewUsers = async (companyId: string) => {
    try {
      const res = await fetch(`/api/companies/${companyId}/users`);
      if (res.ok) {
        const response = await res.json();
        setCompanyUsers(response.data || []);
        setViewingCompanyUsers(companyId);
      } else {
        toast.error('Erro ao carregar usuários');
      }
    } catch (error) {
      toast.error('Erro ao carregar usuários');
    }
  };

  // Funções para CRUD de MASTER_DIST
  const handleCreateMasterUser = (companyId: string) => {
    setEditingMasterUser(null);
    setMasterUserFormData({
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      password: '',
      active: true,
    });
    setMasterUserDialogOpen(true);
  };

  const handleEditMasterUser = (user: any) => {
    setEditingMasterUser(user);
    setMasterUserFormData({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone || '',
      password: '',
      active: user.active,
    });
    setMasterUserDialogOpen(true);
  };

  const handleSaveMasterUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!viewingCompanyUsers) return;

    try {
      const url = editingMasterUser
        ? `/api/companies/${viewingCompanyUsers}/users/${editingMasterUser.id}`
        : `/api/companies/${viewingCompanyUsers}/users`;

      const method = editingMasterUser ? 'PUT' : 'POST';

      const payload = editingMasterUser
        ? { ...masterUserFormData, password: masterUserFormData.password || undefined }
        : { ...masterUserFormData, role: 'MASTER_DIST' };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingMasterUser ? 'Usuário atualizado!' : 'Usuário criado!');
        setMasterUserDialogOpen(false);
        handleViewUsers(viewingCompanyUsers); // recarrega lista
      } else {
        const error = await res.json();
        toast.error(error.message || 'Erro ao salvar usuário');
      }
    } catch (error) {
      toast.error('Erro ao salvar usuário');
    }
  };

  const handleDeleteMasterUser = async (userId: string) => {
    if (!viewingCompanyUsers || !confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      const res = await fetch(`/api/companies/${viewingCompanyUsers}/users/${userId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Usuário excluído!');
        handleViewUsers(viewingCompanyUsers);
      } else {
        toast.error('Erro ao excluir usuário');
      }
    } catch (error) {
      toast.error('Erro ao excluir usuário');
    }
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
              <CardTitle>Empresas Cadastradas</CardTitle>
              <CardDescription>Gerencie as empresas do sistema multi-tenant</CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Empresa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingCompany ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
                  <DialogDescription>
                    {editingCompany ? 'Atualize os dados da empresa' : 'Cadastre uma nova empresa no sistema'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome da Empresa *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="slug">Slug (URL) *</Label>
                        <Input
                          id="slug"
                          value={formData.slug}
                          onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                          placeholder="minha-empresa"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cnpj_cpf">CNPJ/CPF</Label>
                        <Input
                          id="cnpj_cpf"
                          value={formData.cnpj_cpf}
                          onChange={(e) => setFormData({ ...formData, cnpj_cpf: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Endereço</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">Cidade</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">Estado</Label>
                        <Input
                          id="state"
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          maxLength={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zip_code">CEP</Label>
                        <Input
                          id="zip_code"
                          value={formData.zip_code}
                          onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* {!editingCompany && (
                      <>
                        <div className="border-t pt-4 mt-4">
                          <h3 className="text-lg font-semibold mb-4">Dados do Master_Dist (Administrador da Distribuidora)</h3>
                          <div className="grid gap-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="master_first_name">Nome *</Label>
                                <Input
                                  id="master_first_name"
                                  value={masterUserData.first_name}
                                  onChange={(e) => setMasterUserData({ ...masterUserData, first_name: e.target.value })}
                                  required={!editingCompany}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="master_last_name">Sobrenome *</Label>
                                <Input
                                  id="master_last_name"
                                  value={masterUserData.last_name}
                                  onChange={(e) => setMasterUserData({ ...masterUserData, last_name: e.target.value })}
                                  required={!editingCompany}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="master_email">E-mail *</Label>
                              <Input
                                id="master_email"
                                type="email"
                                value={masterUserData.email}
                                onChange={(e) => setMasterUserData({ ...masterUserData, email: e.target.value })}
                                required={!editingCompany}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="master_phone">Telefone</Label>
                                <Input
                                  id="master_phone"
                                  value={masterUserData.phone}
                                  onChange={(e) => setMasterUserData({ ...masterUserData, phone: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="master_password">Senha *</Label>
                                <Input
                                  id="master_password"
                                  type="password"
                                  value={masterUserData.password}
                                  onChange={(e) => setMasterUserData({ ...masterUserData, password: e.target.value })}
                                  required={!editingCompany}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )} */}

                    {editingCompany && (
                      <div className="space-y-2">
                        <Label htmlFor="logo">Logo da Empresa</Label>
                        <div className="flex gap-2">
                          <Input
                            id="logo"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={uploading}
                          />
                          {uploading && <span className="text-sm text-gray-500">Enviando...</span>}
                        </div>
                        {formData.logo_url && (
                          <div className="mt-2">
                            <img src={formData.logo_url} alt="Logo" className="h-16 w-16 object-cover rounded" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="active"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="active">Empresa ativa</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={uploading}>
                      {editingCompany ? 'Atualizar' : 'Criar'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Logo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    {company.logo_url ? (
                      <img src={company.logo_url} alt={company.name} className="h-10 w-10 object-cover rounded" />
                    ) : (
                      <Building2 className="h-10 w-10 text-gray-400" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">{company.slug}</code>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {company.email && <div>{company.email}</div>}
                      {company.phone && <div>{company.phone}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={company.active ? 'default' : 'secondary'}>
                      {company.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewUsers(company.id)}
                        title="Ver Usuários"
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(company)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(company.id)}>
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

      {/* Dialog para visualizar usuários da empresa */}
      <Dialog open={!!viewingCompanyUsers} onOpenChange={() => setViewingCompanyUsers(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Usuários Master_Dist da Empresa</DialogTitle>
            <DialogDescription>
              Lista de administradores da distribuidora
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {companyUsers.length === 0 ? (
              <p className="text-center text-gray-500">Nenhum usuário encontrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyUsers.filter((u: any) => u.role === 'MASTER_DIST').map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={user.active ? 'default' : 'secondary'}>
                          {user.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditMasterUser(user)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteMasterUser(user.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => handleCreateMasterUser(viewingCompanyUsers!)}>Novo Master_Dist</Button>
            <Button variant="outline" onClick={() => setViewingCompanyUsers(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para criar/editar MASTER_DIST */}
      <Dialog open={masterUserDialogOpen} onOpenChange={setMasterUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMasterUser ? 'Editar Master_Dist' : 'Novo Master_Dist'}</DialogTitle>
            <DialogDescription>
              {editingMasterUser ? 'Atualize os dados do administrador' : 'Cadastre um novo administrador para a empresa'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveMasterUser}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mu_first_name">Nome *</Label>
                  <Input
                    id="mu_first_name"
                    value={masterUserFormData.first_name}
                    onChange={(e) => setMasterUserFormData({ ...masterUserFormData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mu_last_name">Sobrenome *</Label>
                  <Input
                    id="mu_last_name"
                    value={masterUserFormData.last_name}
                    onChange={(e) => setMasterUserFormData({ ...masterUserFormData, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mu_email">E-mail *</Label>
                <Input
                  id="mu_email"
                  type="email"
                  value={masterUserFormData.email}
                  onChange={(e) => setMasterUserFormData({ ...masterUserFormData, email: e.target.value })}
                  required
                  disabled={!!editingMasterUser}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mu_password">Senha {!editingMasterUser && '*'}</Label>
                <Input
                  id="mu_password"
                  type="password"
                  value={masterUserFormData.password}
                  onChange={(e) => setMasterUserFormData({ ...masterUserFormData, password: e.target.value })}
                  required={!editingMasterUser}
                  placeholder={editingMasterUser ? 'Deixe em branco para manter a atual' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mu_phone">Telefone</Label>
                <Input
                  id="mu_phone"
                  value={masterUserFormData.phone}
                  onChange={(e) => setMasterUserFormData({ ...masterUserFormData, phone: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="mu_active"
                  checked={masterUserFormData.active}
                  onChange={(e) => setMasterUserFormData({ ...masterUserFormData, active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="mu_active">Usuário ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMasterUserDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingMasterUser ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}