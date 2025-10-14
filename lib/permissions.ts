
import { UserRole } from '@prisma/client';

// ===== DEFINIÇÕES DE PERMISSÕES =====

export interface Permission {
  resource: string;
  actions: string[];
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // ADMINISTRADOR: Master do sistema - gerencia empresas e Sub_Masters
  ADMINISTRADOR: [
    { resource: 'companies', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'uploads', actions: ['create', 'delete'] }
  ],
  // SUB_MASTER: Administrador secundário (pode gerenciar empresas mas pode ser excluído)
  SUB_MASTER: [
    { resource: 'companies', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'uploads', actions: ['create', 'delete'] }
  ],
  // MASTER_DIST: Administrador da distribuidora (não pode criar empresas)
  MASTER_DIST: [
    { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'categories', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'products', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'customers', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'orders', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'financial', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'audit', actions: ['read'] },
    { resource: 'uploads', actions: ['create', 'delete'] },
    { resource: 'reports', actions: ['read', 'export'] }
  ],
  // ATENDENTE/VENDEDOR: Apenas pedidos e clientes (não pode cadastrar produtos/categorias)
  ATENDENTE: [
    { resource: 'products', actions: ['read'] },
    { resource: 'categories', actions: ['read'] },
    { resource: 'customers', actions: ['create', 'read', 'update'] },
    { resource: 'orders', actions: ['create', 'read', 'update'] },
    { resource: 'reports', actions: ['read'] }
  ],
  FINANCEIRO: [
    { resource: 'orders', actions: ['read'] },
    { resource: 'financial', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'reports', actions: ['read', 'export'] }
  ],
  LEITURA: [
    { resource: 'products', actions: ['read'] },
    { resource: 'categories', actions: ['read'] },
    { resource: 'customers', actions: ['read'] },
    { resource: 'orders', actions: ['read'] },
    { resource: 'financial', actions: ['read'] },
    { resource: 'reports', actions: ['read'] }
  ]
};

// ===== FUNÇÕES UTILITÁRIAS =====

export function hasPermission(userRole: UserRole, resource: string, action: string): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  
  return permissions.some(permission => 
    permission.resource === resource && permission.actions.includes(action)
  );
}

export function canManageUsers(userRole: UserRole): boolean {
  return hasPermission(userRole, 'users', 'create') || hasPermission(userRole, 'users', 'update');
}

export function canManageProducts(userRole: UserRole): boolean {
  return hasPermission(userRole, 'products', 'create') || hasPermission(userRole, 'products', 'update');
}

export function canManageOrders(userRole: UserRole): boolean {
  return hasPermission(userRole, 'orders', 'create') || hasPermission(userRole, 'orders', 'update');
}

export function canAccessFinancial(userRole: UserRole): boolean {
  return hasPermission(userRole, 'financial', 'read');
}

export function canExportReports(userRole: UserRole): boolean {
  return hasPermission(userRole, 'reports', 'export');
}

export function canViewAuditLogs(userRole: UserRole): boolean {
  return hasPermission(userRole, 'audit', 'read');
}

export function canUploadFiles(userRole: UserRole): boolean {
  return hasPermission(userRole, 'uploads', 'create');
}

// ===== VERIFICAÇÕES DE CONTEXTO =====

export function canAccessCompanyData(userCompanyId: string | null | undefined, targetCompanyId: string): boolean {
  // Se o usuário não tem company_id (ADMINISTRADOR), pode acessar qualquer empresa
  if (!userCompanyId) {
    return true;
  }
  return userCompanyId === targetCompanyId;
}

export function canManageUserRole(currentUserRole: UserRole, targetRole: UserRole): boolean {
  // ADMINISTRADOR (Master) pode criar todos os tipos
  if (currentUserRole === 'ADMINISTRADOR') {
    return ['SUB_MASTER', 'MASTER_DIST', 'ATENDENTE', 'FINANCEIRO', 'LEITURA'].includes(targetRole);
  }
  
  // SUB_MASTER pode criar MASTER_DIST e inferiores (mas não outros SUB_MASTER ou ADMINISTRADOR)
  if (currentUserRole === 'SUB_MASTER') {
    return ['MASTER_DIST', 'ATENDENTE', 'FINANCEIRO', 'LEITURA'].includes(targetRole);
  }
  
  // MASTER_DIST pode criar todos exceto ADMINISTRADOR e SUB_MASTER
  if (currentUserRole === 'MASTER_DIST') {
    return ['MASTER_DIST', 'ATENDENTE', 'FINANCEIRO', 'LEITURA'].includes(targetRole);
  }
  
  return false;
}

export function canDeleteUser(
  currentUserRole: UserRole, 
  targetUserRole: UserRole, 
  isTargetingSelf: boolean,
  isTargetPrimaryAdmin: boolean = false
): boolean {
  // Não pode deletar a si mesmo
  if (isTargetingSelf) return false;
  
  // Ninguém pode deletar o ADMINISTRADOR principal (is_primary_admin = true)
  if (isTargetPrimaryAdmin) return false;
  
  // ADMINISTRADOR pode deletar SUB_MASTER e todos abaixo (exceto o ADMINISTRADOR principal)
  if (currentUserRole === 'ADMINISTRADOR') {
    return ['SUB_MASTER', 'MASTER_DIST', 'ATENDENTE', 'FINANCEIRO', 'LEITURA'].includes(targetUserRole);
  }
  
  // SUB_MASTER pode deletar MASTER_DIST e inferiores
  if (currentUserRole === 'SUB_MASTER') {
    return ['MASTER_DIST', 'ATENDENTE', 'FINANCEIRO', 'LEITURA'].includes(targetUserRole);
  }
  
  // MASTER_DIST pode deletar roles menores
  if (currentUserRole === 'MASTER_DIST') {
    return ['ATENDENTE', 'FINANCEIRO', 'LEITURA'].includes(targetUserRole);
  }
  
  return false;
}

// ===== VALIDAÇÕES DE NEGÓCIO =====

export function validateOrderStatusTransition(currentStatus: string, newStatus: string, userRole: UserRole): boolean {
  const statusFlow: Record<string, string[]> = {
    'RECEBIDO': ['EM_SEPARACAO', 'CANCELADO'],
    'EM_SEPARACAO': ['PRONTO', 'CANCELADO'],
    'PRONTO': ['EM_ROTA', 'CANCELADO'],
    'EM_ROTA': ['ENTREGUE'],
    'ENTREGUE': [], // Status final
    'CANCELADO': [] // Status final
  };

  const allowedNextStatuses = statusFlow[currentStatus] || [];
  const canTransition = allowedNextStatuses.includes(newStatus);
  
  // Apenas admin e MASTER_DIST podem cancelar
  if (newStatus === 'CANCELADO') {
    return canTransition && ['ADMINISTRADOR', 'SUB_MASTER', 'MASTER_DIST'].includes(userRole);
  }
  
  return canTransition;
}

export function canModifyFinancialEntry(userRole: UserRole, entryStatus: string, isLinkedToOrder: boolean): boolean {
  // Entradas vinculadas a pedidos só podem ser modificadas por admin
  if (isLinkedToOrder && userRole !== 'ADMINISTRADOR') {
    return false;
  }
  
  // Entradas pagas só podem ser modificadas por admin
  if (entryStatus === 'PAGO' && userRole !== 'ADMINISTRADOR') {
    return false;
  }
  
  return canAccessFinancial(userRole);
}

// ===== PERMISSÕES BASEADAS EM CONTEXTO =====

export function getAccessibleMenuItems(userRole: UserRole) {
  const menuItems: Array<{
    label: string;
    href: string;
    icon: string;
    roles: UserRole[];
  }> = [
    {
      label: 'Dashboard',
      href: '/admin',
      icon: 'LayoutDashboard',
      roles: ['MASTER_DIST', 'ATENDENTE', 'FINANCEIRO', 'LEITURA']
    },
    {
      label: 'Empresas',
      href: '/admin/empresas',
      icon: 'Building2',
      roles: ['ADMINISTRADOR', 'SUB_MASTER']
    },
    {
      label: 'Administradores',
      href: '/admin/administradores',
      icon: 'Shield',
      roles: ['ADMINISTRADOR']
    },
    {
      label: 'Usuários',
      href: '/admin/usuarios',
      icon: 'Users',
      roles: ['MASTER_DIST']
    },
    {
      label: 'Categorias',
      href: '/admin/categorias',
      icon: 'Tags',
      roles: ['MASTER_DIST']
    },
    {
      label: 'Produtos',
      href: '/admin/produtos',
      icon: 'Package',
      roles: ['MASTER_DIST', 'ATENDENTE', 'LEITURA']
    },
    {
      label: 'Clientes',
      href: '/admin/clientes',
      icon: 'Users',
      roles: ['MASTER_DIST', 'ATENDENTE']
    },
    {
      label: 'Pedidos',
      href: '/admin/pedidos',
      icon: 'ShoppingCart',
      roles: ['MASTER_DIST', 'ATENDENTE', 'LEITURA']
    },
    // {
    //   label: 'Financeiro',
    //   href: '/admin/financeiro',
    //   icon: 'DollarSign',
    //   roles: ['MASTER_DIST', 'FINANCEIRO', 'LEITURA']
    // },
    {
      label: 'Logs de Auditoria',
      href: '/admin/auditoria',
      icon: 'FileText',
      roles: ['MASTER_DIST']
    },
    {
      label: 'Relatórios',
      href: '/admin/relatorios',
      icon: 'BarChart3',
      roles: ['MASTER_DIST', 'FINANCEIRO', 'LEITURA']
    }
  ];

  return menuItems.filter(item => item.roles.includes(userRole));
}

// ===== VALIDAÇÕES DE UI =====

export function shouldShowCreateButton(userRole: UserRole, resource: string): boolean {
  return hasPermission(userRole, resource, 'create');
}

export function shouldShowEditButton(userRole: UserRole, resource: string): boolean {
  return hasPermission(userRole, resource, 'update');
}

export function shouldShowDeleteButton(userRole: UserRole, resource: string): boolean {
  return hasPermission(userRole, resource, 'delete');
}

export function shouldShowExportButton(userRole: UserRole): boolean {
  return canExportReports(userRole);
}

// ===== HELPERS PARA FILTROS DE DADOS =====

export function getOrderFiltersForRole(userRole: UserRole) {
  const baseFilters = ['status', 'date_range', 'customer'];
  
  if (['ADMINISTRADOR', 'MASTER_DIST'].includes(userRole)) {
    return [...baseFilters, 'user', 'payment_method'];
  }
  
  return baseFilters;
}

export function getFinancialFiltersForRole(userRole: UserRole) {
  const baseFilters = ['type', 'status', 'date_range'];
  
  if (['ADMINISTRADOR', 'MASTER_DIST', 'FINANCEIRO'].includes(userRole)) {
    return [...baseFilters, 'category', 'payment_method'];
  }
  
  return baseFilters;
}
