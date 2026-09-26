'use client';

import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Package, ShoppingBag, MessageSquareText, Truck, Users, History, Settings, Palette, ExternalLink, LogOut, RefreshCw, ArrowUpRight, Wallet, Clock3, Printer, BarChart3, Globe, ShieldCheck } from 'lucide-react';
import { Sidebar, SidebarProvider, SidebarContent, SidebarHeader, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ProductManager, ReviewManager, ShippingManager, printLabel } from './admin-client';
import { ActivityLog, MembersManager } from './members-client';
import { SettingsManager } from './settings-client';
import { AppearanceManager } from './appearance-client';
import { ReportsCenter } from './reports-client';
import { OrdersCenter, type OrderStore } from './orders-client';
import { StoresManager, storeHost, type StoreItem } from './stores-client';
import { RolesManager } from './roles-client';
import type { Permission } from '@/lib/permissions';
import { useStoreConfig } from '../store-config';

type Order = { order_number: string; customer_name: string; customer_phone: string; shipping_address: string; items_json: string; total: number; status: string; created_at: string };
type Section = 'overview' | 'orders' | 'reports' | 'reviews' | 'products' | 'shipping' | 'appearance' | 'settings' | 'members' | 'activity' | 'stores' | 'roles';
type NavItem = { key: Section; label: string; icon: typeof LayoutDashboard; description: string; permission?: Permission; superAdmin?: boolean };
// Menu items are shown only when the admin's role has the permission (the API checks it too).
// "Platform" items are only for the platform super_admin.
const navigationGroups: { label: string; items: NavItem[] }[] = [
  { label: 'Ringkasan', items: [
    { key:'overview', label:'Dashboard', icon:LayoutDashboard, permission:'orders.view', description:'Aktivitas terbaru toko ini.' },
  ] },
  { label: 'Platform', items: [
    { key:'stores', label:'Website', icon:Globe, superAdmin:true, description:'Semua website di platform: buat, lihat, ubah, dan kelola.' },
    { key:'roles', label:'Peran & izin', icon:ShieldCheck, superAdmin:true, description:'Peran dan izin anggota untuk semua toko.' },
  ] },
  { label: 'Penjualan', items: [
    { key:'orders', label:'Pesanan', icon:ShoppingBag, permission:'orders.view', description:'Periksa pembayaran dan siapkan pesanan pelanggan.' },
    { key:'reports', label:'Laporan', icon:BarChart3, permission:'reports.view', description:'Laporan keuangan, penjualan produk, dan stok inventori.' },
    { key:'reviews', label:'Ulasan', icon:MessageSquareText, permission:'reviews.manage', description:'Kelola ulasan dan penilaian produk.' },
  ] },
  { label: 'Katalog & toko', items: [
    { key:'products', label:'Produk', icon:Package, permission:'products.view', description:'Kelola katalog, variasi, harga, dan stok produk.' },
    { key:'shipping', label:'Pengiriman', icon:Truck, permission:'shipping.manage', description:'Atur layanan pengiriman yang tersedia untuk pelanggan.' },
    { key:'appearance', label:'Tampilan', icon:Palette, permission:'settings.manage', description:'Logo, warna, tata letak, dan isi beranda toko.' },
    { key:'settings', label:'Pengaturan', icon:Settings, permission:'settings.manage', description:'Kontak, pembayaran, dan pengiriman toko.' },
  ] },
  { label: 'Tim', items: [
    { key:'members', label:'Anggota', icon:Users, permission:'members.view', description:'Atur siapa saja yang boleh mengelola toko ini.' },
    { key:'activity', label:'Aktivitas', icon:History, permission:'audit.view', description:'Riwayat tindakan admin di toko ini.' },
  ] },
];
const navigation = navigationGroups.flatMap((group) => group.items);
const initials = (name:string) => `${name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toLowerCase() || 's'}.`;
const statuses: Record<string,string> = { menunggu_pembayaran:'Menunggu pembayaran', dibayar:'Sudah dibayar', diproses:'Diproses', dikirim:'Dikirim', selesai:'Selesai', dibatalkan:'Dibatalkan' };
const money = (value:number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
const paid = (order:Order) => ['dibayar','diproses','dikirim','selesai'].includes(order.status);
const date = (value:string) => new Date(value).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
function orderItems(order:Order) { try { return JSON.parse(order.items_json) as {name:string;quantity:number;sku?:string;preorder?:boolean;preorderDays?:number;color?:string;size?:string}[]; } catch {return [];} }
function Status({value}:{value:string}) {
  const color = value === 'dibatalkan' ? 'bg-red-50 text-red-700' : ['dibayar','selesai'].includes(value) ? 'bg-emerald-50 text-emerald-700' : value === 'menunggu_pembayaran' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700';
  return <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${color}`}><span className="h-1.5 w-1.5 rounded-full bg-current"/>{statuses[value] || value}</span>;
}
function Navigation({section,onSelect,adminName,groups,storeName,roleLabel}:{section:Section;onSelect:(s:Section)=>void;adminName:string;groups:typeof navigationGroups;storeName:string;roleLabel:string}) {
  const {setOpenMobile} = useSidebar();
  return <Sidebar collapsible="offcanvas" className="border-r">
    <SidebarHeader className="px-6 py-7"><a href="/admin" className="flex items-center gap-3"><span className="grid h-10 w-10 place-content-center rounded-xl bg-blue-600 font-bold text-white">{initials(storeName)}</span><span className="text-lg font-bold text-slate-900">{storeName.toLowerCase()}<span className="block text-xs font-normal tracking-wide text-slate-500">STORE ADMIN</span></span></a></SidebarHeader>
    <SidebarContent className="gap-0 pb-4">{groups.map((group)=><SidebarGroup key={group.label} className="px-4 py-2"><SidebarGroupLabel className="mb-1 text-xs tracking-widest">{group.label.toUpperCase()}</SidebarGroupLabel><SidebarMenu className="gap-1">{group.items.map(({key,label,icon:Icon})=><SidebarMenuItem key={key}><SidebarMenuButton size="lg" isActive={section===key} onClick={()=>{onSelect(key);setOpenMobile(false);}} className="gap-3 rounded-lg px-4"><Icon/><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroup>)}</SidebarContent>
    <SidebarFooter className="gap-4 border-t p-5"><a href="/" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">Lihat toko <ExternalLink size={15}/></a><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-content-center rounded-full bg-blue-50 font-semibold text-blue-700">{adminName.slice(0,1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{adminName}</p><p className="text-xs">{roleLabel}</p></div><form action="/api/admin/logout" method="post"><button type="submit" aria-label="Keluar" title="Keluar"><LogOut size={17}/></button></form></div></SidebarFooter>
  </Sidebar>;
}

export function AdminDashboard({initialOrders,adminName,storeName,roleLabel,permissions,superAdmin}:{initialOrders:Order[];adminName:string;storeName:string;roleLabel:string;permissions:Permission[];superAdmin:boolean}) {
  const allowed = (item: NavItem) => item.superAdmin ? superAdmin : !item.permission || permissions.includes(item.permission);
  const groups = navigationGroups.map((group) => ({ ...group, items: group.items.filter(allowed) })).filter((group) => group.items.length);
  // Websites for the super admin's filters (orders & reports of every website).
  const [platformStores,setPlatformStores] = useState<StoreItem[]>([]);
  const loadStores = useCallback(() => { if (superAdmin) void fetch('/api/platform/stores').then((response) => response.ok ? response.json() as Promise<{ stores: StoreItem[] }> : { stores: [] }).then((data) => setPlatformStores(data.stores)).catch(() => {}); }, [superAdmin]);
  useEffect(() => { loadStores(); }, [loadStores]);
  const storeOptions: OrderStore[] | undefined = superAdmin ? platformStores.map((item) => ({ id: item.id, name: item.name, url: storeHost(item) ? `https://${storeHost(item)}` : '' })) : undefined;
  const store = useStoreConfig();
  const [section,setSection] = useState<Section>('overview');
  const [editMode,setEditMode] = useState(false);
  const [orders,setOrders] = useState(initialOrders);
  // Status chosen on the dashboard summary, opened in the orders section.
  const [filter,setFilter] = useState('');
  const [selected,setSelected] = useState<string|null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  useEffect(()=>{
    const sync = () => {const params=new URLSearchParams(location.search);setEditMode((params.has('edit')||params.has('new')));const value=params.get('section');setSection((params.has('edit')||params.has('new'))?'products':navigation.some(n=>n.key===value)?value as Section:'overview');};
    sync();window.addEventListener('popstate',sync);return ()=>window.removeEventListener('popstate',sync);
  },[]);
  const choose = (value:Section) => {setSection(value);setEditMode(false);history.pushState(null,'',`/admin?section=${value}`);};
  async function update(order:Order,status:string) {
    setBusy(true);setMessage('');
    try {const response=await fetch('/api/admin/orders',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({orderNumber:order.order_number,status})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error || 'Status gagal disimpan.');setOrders(current=>current.map(row=>row.order_number===order.order_number?{...row,status}:row));setMessage('Status pesanan tersimpan.');}catch(error){setMessage(error instanceof Error?error.message:'Koneksi terputus. Coba lagi.');}finally{setBusy(false);}
  }
  const activeOrder=orders.find(order=>order.order_number===selected);
  const revenue=orders.filter(paid).reduce((sum,order)=>sum+order.total,0);
  const pending=orders.filter(order=>order.status==='menunggu_pembayaran').length;
  const processing=orders.filter(order=>['dibayar','diproses'].includes(order.status)).length;
  const days=Array.from({length:7},(_,index)=>{const d=new Date();d.setDate(d.getDate()-6+index);const key=d.toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});return {label:d.toLocaleDateString('id-ID',{weekday:'short'}),value:orders.filter(order=>paid(order)&&new Date(order.created_at).toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'})===key).reduce((sum,order)=>sum+order.total,0)};});
  const maximum=Math.max(1,...days.map(day=>day.value));
  const orderTable=(rows:Order[]) => <Table><TableHeader><TableRow className="bg-slate-50/80"><TableHead className="pl-5">Pesanan</TableHead><TableHead>Pelanggan</TableHead><TableHead>Tanggal</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="pr-5 text-right">Detail</TableHead></TableRow></TableHeader><TableBody>{rows.length?rows.map(order=><TableRow key={order.order_number}><TableCell className="py-4 pl-5 font-semibold text-blue-600"><button onClick={()=>setSelected(order.order_number)}>{order.order_number}</button></TableCell><TableCell><span className="font-medium">{order.customer_name}</span><span className="block text-xs text-slate-500">{orderItems(order).reduce((sum,item)=>sum+item.quantity,0)} barang</span></TableCell><TableCell className="text-slate-500">{date(order.created_at)}</TableCell><TableCell><Status value={order.status}/></TableCell><TableCell className="text-right font-semibold">{money(order.total)}</TableCell><TableCell className="pr-5 text-right"><Button variant="ghost" size="icon" aria-label={`Detail ${order.order_number}`} onClick={()=>setSelected(order.order_number)}><ArrowUpRight size={17}/></Button></TableCell></TableRow>):<TableRow><TableCell colSpan={6} className="py-16 text-center text-slate-500">Belum ada pesanan yang sesuai.</TableCell></TableRow>}</TableBody></Table>;
  return <div className="admin-workspace min-h-screen"><SidebarProvider><Navigation section={section} onSelect={choose} adminName={adminName} groups={groups} storeName={storeName} roleLabel={roleLabel}/><SidebarInset className="min-w-0 bg-transparent">
    <header className="sticky top-0 z-20 flex h-18 items-center justify-between gap-3 border-b bg-white/95 px-4 backdrop-blur sm:px-8"><div className="flex items-center gap-3"><SidebarTrigger aria-label="Buka atau tutup menu"/><span className="text-sm text-slate-400">Admin / <span className="text-slate-800">{navigation.find(item=>item.key===section)?.label}</span></span></div><div className="flex items-center gap-4"><span className="hidden text-sm text-slate-500 sm:block">{storeName}</span><a href="/" className="flex items-center gap-2 text-sm font-semibold text-blue-600">Buka toko <ExternalLink size={15}/></a></div></header>
    <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl sm:text-3xl">{editMode?'Kelola produk':navigation.find(item=>item.key===section)?.label}</h1><p className="mt-1.5 text-sm text-slate-500">{section==='overview'?`Selamat datang, ${adminName}. Berikut aktivitas toko Anda.`:navigation.find(item=>item.key===section)?.description}</p></div><Button variant="outline" onClick={()=>location.reload()} className="bg-white"><RefreshCw size={15}/> Muat ulang</Button></div>
      {section==='overview'&&<>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{label:'Penjualan terkonfirmasi',value:money(revenue),icon:Wallet,color:'bg-blue-50 text-blue-600',note:'Termasuk ongkir'},{label:'Total pesanan',value:orders.length,icon:ShoppingBag,color:'bg-violet-50 text-violet-600',note:'Pesanan yang dimuat'},{label:'Menunggu pembayaran',value:pending,icon:Clock3,color:'bg-amber-50 text-amber-600',note:'Perlu konfirmasi pembayaran'},{label:'Perlu disiapkan',value:processing,icon:Package,color:'bg-emerald-50 text-emerald-600',note:'Sudah dibayar atau diproses'}].map(({label,value,icon:Icon,color,note})=><Card key={label} className="shadow-none ring-slate-200/70"><CardContent><div className="flex items-center justify-between"><span className="text-sm text-slate-500">{label}</span><span className={`rounded-lg p-2.5 ${color}`}><Icon size={19}/></span></div><p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs text-slate-400">{note}</p></CardContent></Card>)}</div>
        <div className="my-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]"><Card className="ring-slate-200/70"><CardContent><div className="flex items-center justify-between"><h2 className="text-base">Penjualan 7 hari terakhir</h2><span className="text-xs text-slate-500">IDR · WIB</span></div><p className="mt-3 text-2xl font-semibold">{money(days.reduce((sum,day)=>sum+day.value,0))}</p><div className="mt-6 flex h-44 items-end gap-3 border-b border-slate-200 px-2">{days.map((day,index)=><div key={index} className="flex h-full flex-1 flex-col justify-end gap-1 text-center" title={`${day.label}: ${money(day.value)}`}><span className="text-[12px] text-slate-500">{day.value?new Intl.NumberFormat('id-ID',{notation:'compact'}).format(day.value):'0'}</span><div className="mx-auto w-full max-w-12 rounded-t-md bg-blue-500" style={{height:`${day.value?Math.max(4,day.value/maximum*82):1}%`}}/></div>)}</div><div className="flex gap-3 px-2 pt-2">{days.map((day,index)=><span key={index} className="flex-1 text-center text-xs text-slate-500">{day.label}</span>)}</div><p className="mt-5 text-xs text-slate-400">Berdasarkan maksimal 200 pesanan terbaru yang dimuat.</p></CardContent></Card><Card className="ring-slate-200/70"><CardContent><h2 className="text-base">Ringkasan status pesanan</h2><div className="mt-6 space-y-5">{Object.entries(statuses).map(([key,label])=>{const count=orders.filter(order=>order.status===key).length;return <button key={key} className="block w-full text-left" onClick={()=>{setFilter(key);choose('orders');}}><span className="mb-2 flex justify-between text-sm"><span className="text-slate-600">{label}</span><b>{count}</b></span><span className="block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-500" style={{width:`${orders.length?count/orders.length*100:0}%`}}/></span></button>;})}</div></CardContent></Card></div>
        <Card className="gap-0 ring-slate-200/70"><div className="flex items-center justify-between px-5 pb-4"><h2 className="text-base">Pesanan terbaru</h2><Button variant="ghost" onClick={()=>{setFilter('');choose('orders');}}>Lihat semua <ArrowUpRight size={16}/></Button></div>{orderTable(orders.slice(0,6))}</Card>
      </>}
      {section==='products'&&<ProductManager key={editMode?'editor':'catalog'} permissions={permissions}/>}{section==='reviews'&&permissions.includes('reviews.manage')&&<ReviewManager/>}{section==='shipping'&&permissions.includes('shipping.manage')&&<ShippingManager/>}{section==='members'&&permissions.includes('members.view')&&<MembersManager canManage={permissions.includes('members.manage')}/>}{section==='activity'&&permissions.includes('audit.view')&&<ActivityLog/>}{section==='settings'&&permissions.includes('settings.manage')&&<SettingsManager/>}{section==='appearance'&&permissions.includes('settings.manage')&&<AppearanceManager/>}{section==='reports'&&permissions.includes('reports.view')&&<ReportsCenter endpoint={superAdmin?'/api/platform/reports':'/api/admin/reports'} stores={storeOptions}/>}{section==='stores'&&superAdmin&&<StoresManager onChanged={loadStores}/>}{section==='roles'&&superAdmin&&<RolesManager/>}
      {section==='orders'&&<OrdersCenter key={`${filter}:${superAdmin}`} stores={storeOptions} canUpdate={permissions.includes('orders.update')} initialStatus={filter}/>}
    </div>
    <Sheet open={Boolean(activeOrder)} onOpenChange={open=>{if(!open){setSelected(null);setMessage('');}}}><SheetContent className="admin-workspace w-full overflow-y-auto sm:max-w-xl"><SheetHeader className="border-b p-6"><SheetTitle>Detail pesanan</SheetTitle><SheetDescription>{activeOrder?.order_number}</SheetDescription></SheetHeader>{activeOrder&&<div className="space-y-6 p-6"><Status value={activeOrder.status}/><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Pelanggan & pengiriman</p><h3>{activeOrder.customer_name}</h3><a className="text-sm text-blue-600" href={`https://wa.me/${activeOrder.customer_phone.replace(/\D/g,'').replace(/^0/,'62')}`}>{activeOrder.customer_phone}</a><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{activeOrder.shipping_address}</p></div><div className="border-y py-4">{orderItems(activeOrder).map((item,index)=><div key={index} className="py-2 text-sm"><b>{item.quantity} × {item.name}</b><p className="mt-1 text-slate-500">{[item.sku,item.color,item.size,item.preorder?`Pre-order ${item.preorderDays || 2} hari setelah pembayaran`:''].filter(Boolean).join(' · ')}</p></div>)}</div><div className="flex justify-between font-semibold"><span>Total pembayaran</span><span>{money(activeOrder.total)}</span></div><label className="block text-sm font-medium">Status pesanan<select className="mt-2 block w-full border bg-white p-3" disabled={busy} value={activeOrder.status} onChange={event=>update(activeOrder,event.target.value)}>{Object.entries(statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>{message&&<p role="status" className="text-sm">{message}</p>}<Button variant="outline" className="w-full" onClick={()=>printLabel(activeOrder,{name:store.name,phone:store.phone||(store.whatsapp.startsWith('62')?`0${store.whatsapp.slice(2)}`:store.whatsapp),address:store.address})}><Printer size={16}/> Cetak label pengiriman A6</Button><p className="text-xs text-slate-500">Label alamat internal. Resi resmi kurir belum tersedia.</p></div>}</SheetContent></Sheet>
  </SidebarInset></SidebarProvider></div>;
}
