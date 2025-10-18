// // src/components/public/login-customer.tsx
// 'use client';

// import React, { startTransition, useState } from 'react';
// import { useRouter, useSearchParams } from 'next/navigation';
// import { toast } from 'sonner';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Button } from '@/components/ui/button';
// import { useAuth } from '@/context/AuthContext';

// interface Company {
//   id: string;
//   name: string;
//   logo_url?: string;
//   slug?: string;
// }

// export default function LoginCustomer({ slug, company }: { slug: string; company: Company }) {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const redirect = searchParams?.get('redirect') || `/empresa/${slug}`;

//   const { setUser } = useAuth(); // <-- pega o setter aqui (dentro do componente)
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [loading, setLoading] = useState(false);

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!email || !password) {
//       toast.error('Preencha e-mail e senha');
//       return;
//     }

//     setLoading(true);
//     try {
//       const res = await fetch('/api/customers/login', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           email,
//           password,
//           company_id: company.id,
//         }),
//       });

//       if (res.ok) {
//         const customer = await res.json();

//         // Use startTransition aqui — dentro do handler, com setUser já disponível.
//         startTransition(() => {
//           setUser(customer);
//         });

//         toast.success('Login realizado!');
//         router.push(redirect);
//       } else {
//         const err = await res.json().catch(() => ({}));
//         toast.error(err?.error || 'Credenciais inválidas');
//       }
//     } catch (err) {
//       console.error('Login error:', err);
//       toast.error('Erro ao tentar logar');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
//       <div className="max-w-md w-full bg-white shadow rounded p-6">
//         <h2 className="text-xl font-bold mb-4">Entrar — {company.name}</h2>

//         <form onSubmit={handleSubmit} className="space-y-4">
//           <div>
//             <Label htmlFor="email">E-mail</Label>
//             <Input
//               id="email"
//               type="email"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               required
//             />
//           </div>

//           <div>
//             <Label htmlFor="password">Senha</Label>
//             <Input
//               id="password"
//               type="password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               required
//             />
//           </div>

//           <Button type="submit" className="w-full" disabled={loading}>
//             {loading ? 'Entrando...' : 'Entrar'}
//           </Button>

//           <div className="text-sm text-center text-gray-600 mt-2">
//             Não tem conta? <a className="text-blue-600" href={`/empresa/${slug}/registerCustomer`}>Crie uma conta</a>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }