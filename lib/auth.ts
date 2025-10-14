
import { NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { User, Company } from './types';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
              active: true
            },
            include: {
              company: true
            }
          });

          if (!user) {
            return null;
          }

          // ADMINISTRADOR não tem empresa associada, então não verificamos company.active
          if (user.role !== 'ADMINISTRADOR' && user.role !== 'SUB_MASTER') {
            if (!user.company || !user.company.active) {
              return null;
            }
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
            role: user.role,
            company_id: user.company_id || null,
            company_name: user.company?.name || null,
            company_slug: user.company?.slug || null,
            company_logo: user.company?.logo_url || null
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.company_id = user.company_id;
        token.company_name = user.company_name;
        token.company_slug = user.company_slug;
        token.company_logo = user.company_logo;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string;
        session.user.company_id = token.company_id as string;
        session.user.company_name = token.company_name as string;
        session.user.company_slug = token.company_slug as string;
        session.user.company_logo = token.company_logo as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  }
};

export async function getServerAuthSession() {
  return await getServerSession(authOptions);
}

// Utility para verificar permissões
export function hasPermission(userRole: string, requiredRoles: string[]): boolean {
  if (userRole === 'ADMINISTRADOR') return true;
  return requiredRoles.includes(userRole);
}

// Utility para verificar se usuário pode acessar dados da empresa
export function canAccessCompany(userCompanyId: string | null | undefined, targetCompanyId: string | null | undefined): boolean {
  // Se o usuário não tem company_id (ADMINISTRADOR), pode acessar qualquer empresa
  if (!userCompanyId) {
    return true;
  }
  // Se ambos têm company_id, verificar se são iguais
  return userCompanyId === targetCompanyId;
}

// Helper para criar filtro de company_id para queries Prisma
export function getCompanyFilter(session: any): Record<string, any> {
  // ADMINISTRADOR e SUB_MASTER não têm filtro de company_id (podem ver todas as empresas)
  if (!session?.user?.company_id || session.user.role === 'ADMINISTRADOR' || session.user.role === 'SUB_MASTER') {
    return {};
  }
  
  return { company_id: session.user.company_id };
}

// Helper para criar filtro de unique constraint considerando company_id
export function getUniqueConstraintFilter(session: any, otherFields: Record<string, any>): Record<string, any> {
  if (!session?.user?.company_id || session.user.role === 'ADMINISTRADOR' || session.user.role === 'SUB_MASTER') {
    // Para ADMINISTRADOR, retornar apenas os outros campos
    return otherFields;
  }
  
  return {
    company_id: session.user.company_id,
    ...otherFields
  };
}

// Helper para obter company_id para criação de recursos
export function getCompanyIdForCreate(session: any, providedCompanyId?: string): string {
  // Se um company_id foi fornecido (ex: na criação de empresa), use ele
  if (providedCompanyId) {
    return providedCompanyId;
  }
  
  // Para ADMINISTRADOR/SUB_MASTER, deve sempre fornecer o company_id explicitamente
  if (!session?.user?.company_id) {
    throw new Error('ADMINISTRADOR deve fornecer company_id ao criar recursos');
  }
  
  return session.user.company_id;
}
