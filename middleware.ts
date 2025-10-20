
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Rotas públicas que não precisam de autenticação
    const publicPaths = ['/login', '/signup', '/empresa', '/api/public-files', '/api/public', '/uploads'];
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
    
    if (isPublicPath) {
      return NextResponse.next();
    }

    // Se não tem token e não é rota pública, redireciona para login
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Verificação de permissões por rota
    const userRole = token.role as string;
    
    // Rotas administrativas - verificar permissões
    if (pathname.startsWith('/admin')) {
      // Rotas exclusivas para ADMINISTRADOR e SUB_MASTER (gerenciamento de empresas)
      if (pathname.startsWith('/admin/empresas')) {
        if (!['ADMINISTRADOR', 'SUB_MASTER'].includes(userRole)) {
          return NextResponse.redirect(new URL('/admin', req.url));
        }
      }
      
      // Rota exclusiva para ADMINISTRADOR (gerenciamento de administradores)
      if (pathname.startsWith('/admin/administradores')) {
        if (userRole !== 'ADMINISTRADOR') {
          return NextResponse.redirect(new URL('/admin', req.url));
        }
      }
      
      // Rotas para MASTER_DIST e superiores (gerenciamento da distribuidora)
      const masterDistPaths = ['/admin/usuarios', '/admin/categorias', '/admin/produtos', '/admin/clientes', '/admin/pedidos', '/admin/auditoria'];
      const isMasterDistPath = masterDistPaths.some(path => pathname.startsWith(path));
      
      if (isMasterDistPath && !['ADMINISTRADOR', 'SUB_MASTER', 'MASTER_DIST'].includes(userRole)) {
        return NextResponse.redirect(new URL('/admin', req.url));
      }
      
      // Rotas financeiras
      if (pathname.startsWith('/admin/financeiro')) {
        if (!['ADMINISTRADOR', 'SUB_MASTER', 'MASTER_DIST', 'FINANCEIRO'].includes(userRole)) {
          return NextResponse.redirect(new URL('/admin', req.url));
        }
      }
      
      // Rotas de relatórios
      if (pathname.startsWith('/admin/relatorios')) {
        if (!['ADMINISTRADOR', 'SUB_MASTER', 'MASTER_DIST', 'FINANCEIRO', 'LEITURA'].includes(userRole)) {
          return NextResponse.redirect(new URL('/admin', req.url));
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => true // O middleware acima já trata a autorização
    }
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - api/public (Public API routes)
     * - api/customers (Customer routes - public access)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|api/public|api/customers|_next/static|_next/image|favicon.ico|public/|uploads/).*)'
  ]
};
