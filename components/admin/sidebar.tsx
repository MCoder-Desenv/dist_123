
'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getAccessibleMenuItems } from '@/lib/permissions';
import { UserRole } from '@prisma/client';
import {
  LayoutDashboard,
  Building2,
  Users,
  Tags,
  Package,
  ShoppingCart,
  DollarSign,
  FileText,
  BarChart3,
  Shield
} from 'lucide-react';

const iconMap = {
  LayoutDashboard,
  Building2,
  Users,
  Tags,
  Package,
  ShoppingCart,
  DollarSign,
  FileText,
  BarChart3,
  Shield
};

export function AdminSidebar() {
  const { data: session } = useSession() || {};
  const pathname = usePathname();

  if (!session?.user) return null;

  const menuItems = getAccessibleMenuItems(session.user.role as UserRole);

  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200">
      <div className="p-6">
        <div className="flex items-center">
          {session.user.company_logo ? (
            <img
              src={session.user.company_logo}
              alt="Logo"
              className="h-8 w-8 rounded-lg object-cover mr-3"
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center mr-3">
              {session.user.role === 'ADMINISTRADOR' || session.user.role === 'SUB_MASTER' ? (
                <Shield className="h-5 w-5 text-white" />
              ) : (
                <Building2 className="h-5 w-5 text-white" />
              )}
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {session.user.company_name || 'Administrador'}
            </h2>
          </div>
        </div>
      </div>

      <nav className="px-4 pb-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap];
            const isActive = pathname === item.href;
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
