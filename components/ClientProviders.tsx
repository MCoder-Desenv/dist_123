// src/components/ClientProviders.tsx
'use client';
import React from 'react';
import { AuthProvider } from '@/context/AuthContext'; // use este caminho consistentemente

export default function ClientProviders({ children, companyId }: { children: React.ReactNode; companyId?: string }) {
  return (
    <AuthProvider companyId={companyId}>
      {children}
    </AuthProvider>
  );
}