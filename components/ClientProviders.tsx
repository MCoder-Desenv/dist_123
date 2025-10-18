'use client';
import React, { useEffect, useState } from 'react';
import { AuthProvider } from '@/context/AuthContext';

export default function ClientProviders({ children, companyId }: { children: React.ReactNode; companyId?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <AuthProvider companyId={companyId}>{children}</AuthProvider>;
}
