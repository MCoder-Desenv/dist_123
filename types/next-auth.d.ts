
import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT, DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: string;
      company_id: string | null; // Null para ADMINISTRADOR
      company_name: string | null;
      company_slug: string | null;
      company_logo?: string | null;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: string;
    company_id: string | null; // Null para ADMINISTRADOR
    company_name: string | null;
    company_slug: string | null;
    company_logo?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role: string;
    company_id: string | null; // Null para ADMINISTRADOR
    company_name: string | null;
    company_slug: string | null;
    company_logo?: string | null;
  }
}
