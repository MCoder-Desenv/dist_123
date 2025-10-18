// 'use client';

// import { useState, useEffect } from 'react';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent } from '@/components/ui/card';
// import { Trash2, Plus, Minus, ShoppingBag, Building2 } from 'lucide-react';
// import Link from 'next/link';
// import { toast } from 'sonner';

// interface CartItem {
//   product_id: string;
//   product_name: string;
//   variant_id?: string;
//   variant_name?: string;
//   unit_price: number;
//   quantity: number;
// }

// interface Company {
//   id: string;
//   name: string;
//   logo_url?: string;
//   slug: string;
// }

// // Normalize keys e retorna a URL correta para usar em <img src=...>
// function getFileUrl(key?: string | null) {
//   if (!key) return null;

//   // já é data url
//   if (key.startsWith('data:')) return key;

//   // já é URL absoluta ou já é rota pública do app
//   if (/^https?:\/\//.test(key) || key.startsWith('//') || key.startsWith('/api/public-files/')) {
//     return key;
//   }

//   // se veio com leading slash (ex: "/products/..."), remova
//   const normalized = key.replace(/^\/+/, '').replace(/^uploads\//, '');

//   // encode cada segmento (preserva /)
//   const encoded = normalized.split('/').map(encodeURIComponent).join('/');

//   return `/api/public-files/${encoded}`;
// }

// export function CartPage({ company }: { company: Company }) {
//   const [cart, setCart] = useState<CartItem[]>([]);
//   const [logoFailed, setLogoFailed] = useState(false);

//   useEffect(() => {
//     loadCart();
//   }, [company.id]);

//   // Resetar fallback se mudar a logo
//   useEffect(() => {
//     setLogoFailed(false);
//   }, [company.logo_url]);

//   const loadCart = () => {
//     const stored = JSON.parse(localStorage.getItem(`cart_${company.id}`) || '[]');
//     setCart(stored);
//   };

//   const updateQuantity = (index: number, delta: number) => {
//     const newCart = [...cart];
//     newCart[index].quantity += delta;
    
//     if (newCart[index].quantity <= 0) {
//       newCart.splice(index, 1);
//       toast.success('Item removido do carrinho');
//     }
    
//     localStorage.setItem(`cart_${company.id}`, JSON.stringify(newCart));
//     setCart(newCart);
//   };

//   const removeItem = (index: number) => {
//     const newCart = cart.filter((_, i) => i !== index);
//     localStorage.setItem(`cart_${company.id}`, JSON.stringify(newCart));
//     setCart(newCart);
//     toast.success('Item removido do carrinho');
//   };

//   const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

//   const logoSrc = getFileUrl(company.logo_url || null);

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header */}
//       <header className="bg-white shadow-sm">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
//           <div className="flex items-center">
//             {logoSrc && !logoFailed ? (
//               <img
//                 src={logoSrc}
//                 alt={company.name}
//                 className="h-10 w-10 object-cover rounded-lg mr-3"
//                 onError={() => setLogoFailed(true)}
//               />
//             ) : (
//               <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
//                 <Building2 className="h-5 w-5 text-white" />
//               </div>
//             )}

//             <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
//           </div>
//         </div>
//       </header>

//       <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         <div className="mb-6">
//           <Link href={`/empresa/${company.slug}`}>
//             <Button variant="outline">← Voltar ao Cardápio</Button>
//           </Link>
//         </div>

//         <Card>
//           <CardContent className="p-6">
//             <h2 className="text-2xl font-bold text-gray-900 mb-6">Seu Carrinho</h2>

//             {cart.length === 0 ? (
//               <div className="text-center py-12 text-gray-500">
//                 <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-gray-400" />
//                 <p className="text-lg">Seu carrinho está vazio</p>
//                 <Link href={`/empresa/${company.slug}`}>
//                   <Button className="mt-4">Ver Cardápio</Button>
//                 </Link>
//               </div>
//             ) : (
//               <>
//                 <div className="space-y-4 mb-6">
//                   {cart.map((item, index) => (
//                     <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-2">
//                       <div className="flex-1">
//                         <h3 className="font-semibold text-gray-900">{item.product_name}</h3>
//                         {item.variant_name && (
//                           <p className="text-sm text-gray-600">{item.variant_name}</p>
//                         )}
//                         <p className="text-sm text-gray-600">R$ {item.unit_price.toFixed(2)}</p>
//                       </div>
//                       <div className="flex items-center gap-3">
//                         <div className="flex items-center gap-2">
//                           <Button
//                             variant="outline"
//                             size="sm"
//                             onClick={() => updateQuantity(index, -1)}
//                           >
//                             <Minus className="h-4 w-4" />
//                           </Button>
//                           <span className="w-12 text-center font-medium">{item.quantity}</span>
//                           <Button
//                             variant="outline"
//                             size="sm"
//                             onClick={() => updateQuantity(index, 1)}
//                           >
//                             <Plus className="h-4 w-4" />
//                           </Button>
//                         </div>
//                         <div className="w-24 text-right font-semibold">
//                           R$ {(item.unit_price * item.quantity).toFixed(2)}
//                         </div>
//                         <Button
//                           variant="outline"
//                           size="sm"
//                           onClick={() => removeItem(index)}
//                           className="shrink-0"
//                         >
//                           <Trash2 className="h-4 w-4" />
//                         </Button>
//                       </div>
//                     </div>
//                   ))}
//                 </div>

//                 <div className="border-t pt-4">
//                   <div className="flex justify-between text-lg font-bold mb-4">
//                     <span>Subtotal:</span>
//                     <span>R$ {subtotal.toFixed(2)}</span>
//                   </div>
//                   <Link href={`/empresa/${company.slug}/checkout`}>
//                     <Button className="w-full" size="lg">
//                       Finalizar Pedido
//                     </Button>
//                   </Link>
//                 </div>
//               </>
//             )}
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   );
// }