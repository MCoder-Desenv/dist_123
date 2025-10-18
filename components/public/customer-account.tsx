// 'use client';

// import { useState, useEffect } from 'react';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// import { Label } from '@/components/ui/label';
// import { Input } from '@/components/ui/input';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Textarea } from '@/components/ui/textarea';
// import { Building2, Package, ShoppingCart, LogOut } from 'lucide-react';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';
// import { toast } from 'sonner';
// import Image from 'next/image';
// import { useAuth } from '@/context/AuthContext';
// import { buscarCEP } from '@/app/api/public/utils/busca-cep';

// interface Company {
//   id: string;
//   name: string;
//   logo_url?: string;
//   slug: string;
// }

// interface Customer {
//   id: string;
//   email: string;
//   name: string;
//   phone?: string | null;
// }

// interface Order {
//   id: string;
//   created_at: string;
//   status: string;
//   total_amount: number;
//   delivery_type: string;
//   order_items: Array<{
//     id: string;
//     quantity: number;
//     unit_price: number;
//     product: {
//       name: string;
//       image_url?: string | null;
//     };
//     variant?: {
//       name?: string | null;
//       image_url?: string | null;
//     } | null;
//   }>;
// }

// /** Normaliza/encode e retorna a URL pública para usar em <Image src> ou <img> */
// function getFileUrl(key?: string | null) : string | null {
//   if (!key) return null;

//   if (key.startsWith('data:')) return key;
//   if (/^https?:\/\//.test(key) || key.startsWith('//') || key.startsWith('/api/public-files/')) {
//     return key;
//   }

//   const normalized = key.replace(/^\/+/, '').replace(/^uploads\//, '');
//   const encoded = normalized.split('/').map(encodeURIComponent).join('/');
//   return `/api/public-files/${encoded}`;
// }

// export function CustomerAccount({ company }: { company: Company }) {
//   const router = useRouter();
//   const { user: authUser, loading: authLoading, logout: authLogout } = useAuth();

//   const [customer, setCustomer] = useState<Customer | null>(null);
//   const [orders, setOrders] = useState<Order[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [showReorderModal, setShowReorderModal] = useState(false);
//   const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
//   const [reorderLoading, setReorderLoading] = useState(false);

//   const [cepLoading, setCepLoading] = useState(false);

//   const [reorderForm, setReorderForm] = useState({
//     delivery_type: 'DELIVERY',
//     address: '',
//     address_number: '',
//     city: '',
//     state: '',
//     zip_code: '',
//     notes: '',
//   });

//   useEffect(() => {
//     if (authLoading) return;

//     if (!authUser) {
//       router.push(`/empresa/${company.slug}`);
//       return;
//     }

//     setCustomer(authUser as Customer);
//     loadOrders((authUser as Customer).id);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [authLoading, authUser, company.slug]);

//   const loadOrders = async (customerId: string) => {
//     setLoading(true);
//     try {
//       const res = await fetch(`/api/customers/orders?customer_id=${customerId}&company_id=${company.id}`);
//       if (res.ok) {
//         const data = await res.json();
//         // dependendo do shape da sua API, ajuste aqui (ex: data.data)
//         setOrders(data || []);
//       } else {
//         setOrders([]);
//       }
//     } catch (error) {
//       console.error(error);
//       toast.error('Erro ao carregar pedidos');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleLogout = () => {
//     try {
//       authLogout();
//     } catch (e) {
//       localStorage.removeItem(`customer_${company.id}`);
//     }
//     router.push(`/empresa/${company.slug}`);
//   };

//   const handleReorder = (order: Order) => {
//     setSelectedOrder(order);
//     // reset form or initialize based on order/customer if desired
//     setReorderForm({
//       delivery_type: order.delivery_type || 'DELIVERY',
//       address: '',
//       address_number: '',
//       city: '',
//       state: '',
//       zip_code: '',
//       notes: '',
//     });
//     setShowReorderModal(true);
//   };

//   const submitReorder = async () => {
//     if (!selectedOrder || !customer) return;

//     // basic validation when delivery
//     if (reorderForm.delivery_type === 'DELIVERY') {
//       const missing = [];
//       if (!reorderForm.address) missing.push('Endereço');
//       if (!reorderForm.address_number) missing.push('N°');
//       if (!reorderForm.city) missing.push('Cidade');
//       if (!reorderForm.state) missing.push('Estado');
//       if (!reorderForm.zip_code) missing.push('CEP');
//       if (missing.length) {
//         toast.error(`Preencha: ${missing.join(', ')}`);
//         return;
//       }
//     }

//     setReorderLoading(true);
//     try {
//       const res = await fetch('/api/customers/reorder', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           order_id: selectedOrder.id,
//           customer_id: customer.id,
//           company_id: company.id,
//           delivery_type: reorderForm.delivery_type,
//           delivery_address:
//             reorderForm.delivery_type === 'DELIVERY'
//               ? {
//                   address: reorderForm.address,
//                   number: reorderForm.address_number,
//                   city: reorderForm.city,
//                   state: reorderForm.state,
//                   zip_code: reorderForm.zip_code,
//                 }
//               : null,
//           notes: reorderForm.notes,
//         }),
//       });

//       if (res.ok) {
//         toast.success('Pedido refeito com sucesso!');
//         setShowReorderModal(false);
//         loadOrders(customer.id);
//       } else {
//         const error = await res.json().catch(() => ({}));
//         toast.error(error.error || 'Erro ao refazer pedido');
//       }
//     } catch (error) {
//       console.error(error);
//       toast.error('Erro ao refazer pedido');
//     } finally {
//       setReorderLoading(false);
//     }
//   };

//   const handleDeliveryTypeChange = (value: string) => {
//     setReorderForm((prev) =>
//       value === 'RETIRADA'
//         ? {
//             ...prev,
//             delivery_type: value,
//             // limpar campos de entrega
//             address: '',
//             address_number: '',
//             city: '',
//             state: '',
//             zip_code: '',
//           }
//         : {
//             ...prev,
//             delivery_type: value,
//           }
//     );
//   };

//   const handleBuscarCEP = async (cepInput?: string) => {
//     const cepToSearch = (cepInput ?? reorderForm.zip_code).replace(/\D/g, '');
//     if (!cepToSearch || cepToSearch.length !== 8) {
//       toast.error('Informe um CEP válido (8 dígitos) para busca.');
//       return;
//     }

//     setCepLoading(true);
//     try {
//       const data = await buscarCEP(cepToSearch);
//       // data from ViaCEP: { cep, logradouro, complemento, bairro, localidade, uf, ... }
//       setReorderForm((prev) => ({
//         ...prev,
//         address: data.logradouro || prev.address,
//         // keep address_number intact so user can fill it
//         city: data.localidade || prev.city,
//         state: (data.uf || prev.state)?.toUpperCase(),
//         zip_code: data.cep ? String(data.cep).replace(/\D/g, '') : prev.zip_code,
//       }));
//       toast.success('Endereço preenchido pelo CEP.');
//     } catch (err: any) {
//       console.error(err);
//       toast.error(err?.message || 'Erro ao buscar CEP');
//     } finally {
//       setCepLoading(false);
//     }
//   };

//   const getStatusColor = (status: string) => {
//     const colors: Record<string, string> = {
//       RECEBIDO: 'bg-blue-100 text-blue-800',
//       EM_SEPARACAO: 'bg-yellow-100 text-yellow-800',
//       PRONTO: 'bg-green-100 text-green-800',
//       EM_ROTA: 'bg-purple-100 text-purple-800',
//       ENTREGUE: 'bg-gray-100 text-gray-800',
//       CANCELADO: 'bg-red-100 text-red-800',
//     };
//     return colors[status] || 'bg-gray-100 text-gray-800';
//   };

//   const getStatusLabel = (status: string) => {
//     const labels: Record<string, string> = {
//       RECEBIDO: 'Recebido',
//       EM_SEPARACAO: 'Em Separação',
//       PRONTO: 'Pronto',
//       EM_ROTA: 'Em Rota',
//       ENTREGUE: 'Entregue',
//       CANCELADO: 'Cancelado',
//     };
//     return labels[status] || status;
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <p>Carregando...</p>
//       </div>
//     );
//   }

//   const logoSrc = getFileUrl(company.logo_url ?? null);

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header */}
//       <header className="bg-white shadow-sm">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
//           {/* Layout responsivo:
//               - mobile (default): coluna -> (linha: logo+nome) / (botões empilhados abaixo)
//               - sm+: linha -> logo+nome (left) e ações (right)
//           */}
//           <div className="flex flex-col sm:flex-row sm:items-center justify-between">
//             <div className="flex items-center">
//               {logoSrc ? (
//                 <div className="relative w-10 h-10 rounded-lg overflow-hidden mr-3 flex-shrink-0">
//                   <Image
//                     src={logoSrc}
//                     alt={company.name}
//                     width={40}
//                     height={40}
//                     className="object-cover"
//                     priority={false}
//                   />
//                 </div>
//               ) : (
//                 <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
//                   <Building2 className="h-5 w-5 text-white" />
//                 </div>
//               )}
//               <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
//             </div>

//             {/* Desktop actions (visível em sm+) */}
//             <div className="hidden sm:flex items-center gap-4">
//               <Link href={`/empresa/${company.slug}`}>
//                 <Button variant="outline">Ver Catálogo</Button>
//               </Link>
//               <Button variant="outline" onClick={handleLogout}>
//                 <LogOut className="h-4 w-4 mr-2" />
//                 Sair
//               </Button>
//             </div>

//             {/* Mobile actions (visível apenas em < sm) - empilhado */}
//             <div className="flex flex-col sm:hidden mt-3 w-full gap-2">
//               <Link href={`/empresa/${company.slug}`} className="w-full">
//                 <Button className="w-full">Ver Catálogo</Button>
//               </Link>
//               <Button className="w-full" variant="outline" onClick={handleLogout}>
//                 Sair
//               </Button>
//             </div>
//           </div>
//         </div>
//       </header>

//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         {/* Customer Info */}
//         <Card className="mb-6">
//           <CardHeader>
//             <CardTitle>Olá, {customer?.name}!</CardTitle>
//             <p className="text-sm text-gray-600">{customer?.email}</p>
//           </CardHeader>
//         </Card>

//         {/* Orders */}
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center gap-2">
//               <Package className="h-5 w-5" />
//               Meus Pedidos
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             {orders.length === 0 ? (
//               <div className="text-center py-8">
//                 <p className="text-gray-500 mb-4">Você ainda não fez nenhum pedido</p>
//                 <Link href={`/empresa/${company.slug}`}>
//                   <Button>Fazer Primeiro Pedido</Button>
//                 </Link>
//               </div>
//             ) : (
//               <div className="space-y-4">
//                 {orders.map((order) => (
//                   <div key={order.id} className="border rounded-lg p-4">
//                     <div className="flex items-start justify-between mb-3">
//                       <div>
//                         <p className="font-medium">Pedido #{order.id.slice(0, 8)}</p>
//                         <p className="text-sm text-gray-600">
//                           {new Date(order.created_at).toLocaleDateString('pt-BR')}
//                         </p>
//                       </div>
//                       <div className="flex items-center gap-2">
//                         <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
//                           {getStatusLabel(order.status)}
//                         </span>
//                       </div>
//                     </div>

//                     <div className="space-y-2 mb-3">
//                       {order.order_items.map((item) => {
//                         const imageUrl =
//                           getFileUrl(item.variant?.image_url ?? null) ||
//                           getFileUrl(item.product.image_url ?? null);

//                         return (
//                           <div key={item.id} className="flex items-center gap-3 text-sm">
//                             {imageUrl ? (
//                               <div className="relative w-10 h-10 bg-muted rounded overflow-hidden">
//                                 <Image
//                                   src={imageUrl}
//                                   alt={item.product.name}
//                                   fill
//                                   sizes="40px"
//                                   className="object-cover"
//                                 />
//                               </div>
//                             ) : (
//                               <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-500">
//                                 {/* pequeno placeholder */}
//                                 <Package className="h-4 w-4" />
//                               </div>
//                             )}
//                             <div className="flex-1">
//                               <span className="font-medium">{item.quantity}x</span> {item.product.name}
//                               {item.variant && <span className="text-gray-500"> ({item.variant.name})</span>}
//                             </div>
//                           </div>
//                         );
//                       })}
//                     </div>

//                     <div className="flex items-center justify-between pt-3 border-t">
//                       <div>
//                         <span className="text-sm text-gray-600">Total: </span>
//                         <span className="font-bold">R$ {parseFloat(order.total_amount.toString()).toFixed(2)}</span>
//                       </div>
//                       <Button size="sm" variant="outline" onClick={() => handleReorder(order)}>
//                         <ShoppingCart className="h-4 w-4 mr-2" />
//                         Recomprar
//                       </Button>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </CardContent>
//         </Card>
//       </div>

//       {/* Reorder Modal */}
//       <Dialog open={showReorderModal} onOpenChange={(open) => { if(!open){ setShowReorderModal(false); } else { setShowReorderModal(open); } }}>
//         <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
//           <DialogHeader>
//             <DialogTitle>Refazer Pedido</DialogTitle>
//           </DialogHeader>

//           {selectedOrder && (
//             <div className="space-y-4">
//               <div className="border rounded-lg p-4 bg-gray-50">
//                 <h4 className="font-medium mb-2">Itens do Pedido:</h4>
//                 {selectedOrder.order_items.map((item) => (
//                   <div key={item.id} className="text-sm mb-1">
//                     {item.quantity}x {item.product.name}
//                     {item.variant && ` (${item.variant.name})`}
//                   </div>
//                 ))}
//               </div>

//               <div>
//                 <Label htmlFor="delivery_type">Tipo de Entrega *</Label>
//                 <Select
//                   value={reorderForm.delivery_type}
//                   onValueChange={(value) => handleDeliveryTypeChange(value)}
//                 >
//                   <SelectTrigger>
//                     <SelectValue />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="DELIVERY">Entrega</SelectItem>
//                     <SelectItem value="RETIRADA">Retirada na Distribuidora</SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>

//               {/* CEP logo abaixo do Tipo de Entrega, com botão de busca ao lado */}
//               {reorderForm.delivery_type === 'DELIVERY' && (
//                 <>
//                   <div className="grid grid-cols-12 gap-4 items-end">
//                     <div className="col-span-12">
//                       <Label htmlFor="zip_code">CEP *</Label>
//                       <div className="flex gap-2">
//                         <Input
//                           id="zip_code"
//                           value={reorderForm.zip_code}
//                           onChange={(e) => setReorderForm((p) => ({ ...p, zip_code: e.target.value }))}
//                           placeholder="00000-000"
//                           required
//                         />
//                         <Button
//                           type="button"
//                           onClick={() => handleBuscarCEP()}
//                           disabled={cepLoading}
//                         >
//                           {cepLoading ? 'Buscando...' : 'Buscar'}
//                         </Button>
//                       </div>
//                     </div>
//                   </div>

//                   {/* Endereço e N° */}
//                   <div className="grid grid-cols-12 gap-4 items-end">
//                     <div className="col-span-8">
//                       <Label htmlFor="address">Endereço *</Label>
//                       <Input
//                         id="address"
//                         value={reorderForm.address}
//                         onChange={(e) => setReorderForm((p) => ({ ...p, address: e.target.value }))}
//                         required
//                       />
//                     </div>
//                     <div className="col-span-4">
//                       <Label htmlFor="address_number">N° *</Label>
//                       <Input
//                         id="address_number"
//                         value={reorderForm.address_number}
//                         onChange={(e) => setReorderForm((p) => ({ ...p, address_number: e.target.value }))}
//                         required
//                       />
//                     </div>
//                   </div>

//                   {/* Cidade / Estado */}
//                   <div className="grid grid-cols-12 gap-4">
//                     <div className="col-span-8">
//                       <Label htmlFor="city">Cidade *</Label>
//                       <Input
//                         id="city"
//                         value={reorderForm.city}
//                         onChange={(e) => setReorderForm((p) => ({ ...p, city: e.target.value }))}
//                         required
//                       />
//                     </div>
//                     <div className="col-span-4">
//                       <Label htmlFor="state">Estado *</Label>
//                       <Input
//                         id="state"
//                         value={reorderForm.state}
//                         onChange={(e) => setReorderForm((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
//                         maxLength={2}
//                         required
//                       />
//                     </div>
//                   </div>
//                 </>
//               )}

//               <div>
//                 <Label htmlFor="notes">Observações</Label>
//                 <Textarea
//                   id="notes"
//                   value={reorderForm.notes}
//                   onChange={(e) => setReorderForm((p) => ({ ...p, notes: e.target.value }))}
//                   rows={3}
//                 />
//               </div>

//               <div className="flex gap-2">
//                 <Button className="flex-1" onClick={submitReorder} disabled={reorderLoading}>
//                   {reorderLoading ? 'Processando...' : 'Confirmar Pedido'}
//                 </Button>
//                 <Button
//                   variant="outline"
//                   onClick={() => {
//                     setShowReorderModal(false);
//                     // opcional: resetar formulário ao fechar
//                     setReorderForm({
//                       delivery_type: 'DELIVERY',
//                       address: '',
//                       address_number: '',
//                       city: '',
//                       state: '',
//                       zip_code: '',
//                       notes: '',
//                     });
//                   }}
//                   disabled={reorderLoading}
//                 >
//                   Cancelar
//                 </Button>
//               </div>
//             </div>
//           )}
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }