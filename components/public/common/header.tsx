'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Building2, ShoppingCart, LogOut } from 'lucide-react';
import { getFileUrl } from '@/components/public/utils/files'; // ✅ ajuste o caminho se necessário

interface Company {
  id: string;
  name: string;
  logo_url?: string | null;
  slug?: string;
}

interface HeaderProps {
  company: Company;

  // auth state (opcional)
  isLogged?: boolean;
  authLoading?: boolean;
  onLogout?: () => void;

  // quais ações exibir (defaults abaixo)
  showCatalogButton?: boolean;
  showLoginButton?: boolean;
  showAccountButton?: boolean;
  showLogoutButton?: boolean;
  showCartButton?: boolean;

  // hrefs customizáveis
  catalogHref?: string;
  loginHref?: string;
  accountHref?: string;
  cartHref?: string;

  className?: string;
}

/**
 * Header reutilizável e responsivo.
 * Desktop: logo+nome à esquerda, botões inline à direita.
 * Mobile: logo+nome no topo, botões empilhados abaixo (cada um full width).
 */
export function Header({
  company,
  isLogged,
  authLoading,
  onLogout,

  showCatalogButton = true,
  showLoginButton = true,
  showAccountButton = true,
  showLogoutButton = true,
  showCartButton = true,

  catalogHref,
  loginHref,
  accountHref,
  cartHref,

  className,
}: HeaderProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoSrc = useMemo(() => getFileUrl(company.logo_url ?? null), [company.logo_url]);

  const effectiveCatalogHref = catalogHref ?? `/empresa/${company.slug ?? ''}`;
  const effectiveLoginHref = loginHref ?? `/empresa/${company.slug ?? ''}/loginCustomer`;
  const effectiveAccountHref = accountHref ?? `/empresa/${company.slug ?? ''}/minha-conta`;
  const effectiveCartHref = cartHref ?? `/empresa/${company.slug ?? ''}/carrinho`;

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem(`customer_${company.id}`);
    }
  };

  return (
    <header className={`bg-white shadow-sm ${className ?? ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* mobile: column, sm+: row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
          {/* left: logo + name */}
          <div className="flex items-center">
            {logoSrc && !logoFailed ? (
              <div className="relative w-10 h-10 rounded-lg overflow-hidden mr-3 flex-shrink-0">
                <Image
                  src={logoSrc}
                  alt={company.name}
                  width={40}
                  height={40}
                  className="object-cover"
                  onError={() => setLogoFailed(true)}
                />
              </div>
            ) : (
              <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                <Building2 className="h-5 w-5 text-white" />
              </div>
            )}
            <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
          </div>

          {/* desktop actions (inline) */}
          <div className="hidden sm:flex items-center gap-4">
            {showCatalogButton && (
              <Link href={effectiveCatalogHref}>
                <Button variant="outline">Ver Catálogo</Button>
              </Link>
            )}

            {authLoading ? (
              <Button className="opacity-60">Carregando...</Button>
            ) : (
              <>
                {!isLogged && showLoginButton && (
                  <Link href={effectiveLoginHref}>
                    <Button>Entrar</Button>
                  </Link>
                )}

                {isLogged && showAccountButton && (
                  <Link href={effectiveAccountHref}>
                    <Button variant="outline">Minhas Compras</Button>
                  </Link>
                )}

                {isLogged && showLogoutButton && (
                  <Button variant="outline" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </Button>
                )}
              </>
            )}

            {showCartButton && (
              <Link href={effectiveCartHref}>
                <Button className="relative">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Carrinho
                </Button>
              </Link>
            )}
          </div>

          {/* mobile actions (stacked full width) */}
          <div className="flex flex-col sm:hidden mt-3 w-full gap-2">
            {showCatalogButton && (
              <Link href={effectiveCatalogHref} className="w-full">
                <Button className="w-full">Ver Catálogo</Button>
              </Link>
            )}

            {authLoading ? (
              <Button className="w-full opacity-60">Carregando...</Button>
            ) : (
              <>
                {!isLogged && showLoginButton && (
                  <Link href={effectiveLoginHref} className="w-full">
                    <Button className="w-full">Entrar</Button>
                  </Link>
                )}

                {isLogged && showAccountButton && (
                  <Link href={effectiveAccountHref} className="w-full">
                    <Button className="w-full" variant="outline">Minhas Compras</Button>
                  </Link>
                )}

                {isLogged && showLogoutButton && (
                  <Button className="w-full" variant="outline" onClick={handleLogout}>
                    Sair
                  </Button>
                )}
              </>
            )}

            {showCartButton && (
              <Link href={effectiveCartHref} className="w-full">
                <Button className="w-full">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Carrinho
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}