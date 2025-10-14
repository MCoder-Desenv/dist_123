'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
}

type AuthContextValue = {
  user: Customer | null;
  loading: boolean;
  setUser: (u: Customer | null) => void;
  login: (u: Customer) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function storageKey(companyId?: string) {
  return `customer_${companyId ?? 'global'}`;
}

export function AuthProvider({ children, companyId }: { children: React.ReactNode; companyId?: string }) {
  const key = storageKey(companyId);
  const [user, setUserState] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider mounted with key', key);
    }, [key]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setUserState(JSON.parse(raw));
    } catch { /* ignore */ }
    setLoading(false);

    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          setUserState(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {
          setUserState(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const setUser = (u: Customer | null) => {
    setUserState(u);
    if (u) localStorage.setItem(key, JSON.stringify(u));
    else localStorage.removeItem(key);
  };

  const login = (u: Customer) => setUser(u);
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// export function useAuth() {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error('useAuth must be used within AuthProvider');
//   return ctx;
// }

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    console.error('useAuth called outside AuthProvider. Call stack:', new Error().stack);
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}