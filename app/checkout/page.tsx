'use client';
import {useEffect,useState} from 'react';
import {preorderLabel,quantityLimit} from '@/lib/preorder';
type Variant={color:string;size:string;price:number;stock:number;sku?:string};
type Product={id:string;name:string;image:string;images?:string[];variants:Variant[];preorder_enabled?:number;preorder_days?:number};
type Line={productId:string;variantIndex:number;quantity:number};
type ShippingOption={courierCode:string;courierName:string;serviceCode:string;serviceName:string;price:number;duration:string};
type Pending={orderNumber:string;token:string;total:number;method:string;redirectUrl?:string;items:Line[];fromCart:boolean};
const rupiah=(value:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
export default function Checkout(){
 const [products,setProducts]=useState<Product[]>([]),[lines,setLines]=useState<Line[]>([]),[loading,setLoading]=useState(true);
 const [pending,setPending]=useState<Pending|null>(null),[status,setStatus]=useState('Menunggu konfirmasi pembayaran.'),[cancelled,setCancelled]=useState(false);
 const [customerName,setCustomerName]=useState(''),[customerPhone,setCustomerPhone]=useState(''),[shippingAddress,setShippingAddress]=useState(''),[destinationPostalCode,setDestinationPostalCode]=useState('');
 const [shippingBusy,setShippingBusy]=useState(false),[shippingError,setShippingError]=useState(''),[shippingOptions,setShippingOptions]=useState<ShippingOption[]>([]),[selectedShipping,setSelectedShipping]=useState<ShippingOption|null>(null);
 const [paymentMethod,setPaymentMethod]=useState<'midtrans'|'manual'>('manual'),[orderBusy,setOrderBusy]=useState(false),[orderError,setOrderError]=useState('');
 const cartRows=lines.flatMap(line=>{const product=products.find(p=>p.id===line.productId);const variant=product?.variants[line.variantIndex];return product&&variant?[{key:line.productId+':'+line.variantIndex,product,variant,quantity:line.quantity}]:[];});
 const subtotal=cartRows.reduce((sum,row)=>sum+row.variant.price*row.quantity,0),shipping=selectedShipping?.price||0;
 useEffect(()=>{let active=true;(async()=>{
  try{
   const params=new URLSearchParams(location.search);
   const saved=JSON.parse(sessionStorage.getItem('sg_pending_payment')||'null') as Pending|null;
   if(params.has('order_id')){
    if(saved?.orderNumber===params.get('order_id')){if(active)setPending(saved);return;}
    throw new Error('Buka halaman pembayaran dari perangkat yang dipakai memesan, atau hubungi admin dengan nomor pesanan.');
   }
   if(saved){location.replace('/checkout?order_id='+encodeURIComponent(saved.orderNumber));return;}
   const response=await fetch('/api/products');if(!response.ok)throw new Error('Produk belum dapat dimuat.');
   const data=await response.json() as {products:Product[]};
   let selected:Line[]=[];
   if(params.get('buy')==='1'){const line=JSON.parse(sessionStorage.getItem('sg_buy_now')||'null');if(line)selected=[line];}
   else {const response=await fetch('/api/cart');if(response.ok){const data=await response.json() as {items:{product_id:string;variant_index:number;quantity:number}[]};selected=data.items.map(i=>({productId:i.product_id,variantIndex:i.variant_index,quantity:i.quantity}));}else if(response.status===401){selected=Object.values(JSON.parse(localStorage.getItem('sg_cart')||'{}'));}else throw new Error('Keranjang belum dapat dimuat.');}
   if(selected.some(line=>{const p=data.products.find(p=>p.id===line.productId);const v=p?.variants[line.variantIndex];return !p||!v||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>quantityLimit(p,v);}))throw new Error('Produk atau stok berubah. Periksa kembali keranjang.');
   if(active){setProducts(data.products);setLines(selected);}
  }catch(error){if(active)setOrderError((error as Error).message);}
  finally{if(active)setLoading(false);}
 })();return()=>{active=false;};},[]);
 useEffect(()=>{
  if(!pending)return;
  let active=true,busy=false,timer:ReturnType<typeof setTimeout>;
  async function check(){
   if(busy)return;busy=true;
   try{
    const response=await fetch('/api/orders/status?order='+encodeURIComponent(pending!.orderNumber),{headers:{authorization:'Bearer '+pending!.token},cache:'no-store'});
    const data=await response.json() as {paid?:boolean;status?:string;error?:string};
    if(!response.ok)throw new Error(data.error||'Status belum dapat diperiksa.');
    if(!active)return;
    if(data.paid){
     setStatus('Pembayaran terkonfirmasi. Kembali ke beranda…');
     if(pending!.fromCart){
      const response=await fetch('/api/cart');
      if(response.ok){const cart=await response.json() as {items:{product_id:string;variant_index:number;quantity:number}[]};for(const item of pending!.items){const current=cart.items.find(i=>i.product_id===item.productId&&i.variant_index===item.variantIndex);if(current)await fetch('/api/cart',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({...item,quantity:Math.max(0,current.quantity-item.quantity)})});}}
      else if(response.status===401){const cart=JSON.parse(localStorage.getItem('sg_cart')||'{}');for(const item of pending!.items){const key=item.productId+':'+item.variantIndex;if(cart[key]){cart[key].quantity-=item.quantity;if(cart[key].quantity<=0)delete cart[key];}}localStorage.setItem('sg_cart',JSON.stringify(cart));}
     }
     sessionStorage.removeItem('sg_pending_payment');sessionStorage.removeItem('sg_buy_now');
     if(active)location.replace('/?payment=success');return;
    }
    setCancelled(data.status==='dibatalkan');
    setStatus(data.status==='dibatalkan'?'Pembayaran dibatalkan atau kedaluwarsa. Hubungi admin jika dana sudah terpotong.':'Menunggu konfirmasi pembayaran. Halaman akan kembali ke beranda setelah pembayaran terkonfirmasi.');
   }catch(error){if(active)setStatus((error as Error).message);}
   finally{busy=false;if(active)timer=setTimeout(check,10000);}
  }
  void check();return()=>{active=false;clearTimeout(timer);};
 },[pending]);
  async function checkShippingRates() {
    setShippingBusy(true);
    setShippingError('');
    setSelectedShipping(null);
    const items = cartRows.map(({ product, quantity, key }) => ({
      id: product.id,
      variantIndex: Number(key.split(':').pop()),
      quantity,
    }));
    try {
      const response = await fetch('/api/shipping/rates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ destinationPostalCode, items }),
      });
      const data = (await response.json()) as {
        options?: ShippingOption[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Ongkir belum tersedia.');
      const options = data.options || [];
      setShippingOptions(options);
      if (!options.length)
        setShippingError('Belum ada layanan kurir untuk tujuan ini.');
    } catch (error) {
      setShippingOptions([]);
      setShippingError(
        error instanceof Error ? error.message : 'Gagal memeriksa ongkir.',
      );
    } finally {
      setShippingBusy(false);
    }
  }

  async function submitOrder() {
    setOrderBusy(true);
    setOrderError('');
    const items = cartRows.map(({ product, quantity, key }) => ({
      id: product.id,
      variantIndex: Number(key.split(':').pop()),
      quantity,
    }));
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          shippingAddress,
          destinationPostalCode,
          shippingOption: selectedShipping
            ? {
                courierCode: selectedShipping.courierCode,
                serviceCode: selectedShipping.serviceCode,
              }
            : null,
          paymentMethod,
          items,
        }),
      });
      const data = (await response.json()) as {
        orderNumber?: string;
        paymentAccessToken?: string;
        total?: number;
        redirectUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.orderNumber || !data.paymentAccessToken)
        throw new Error(data.error || 'Pesanan gagal disimpan.');
      const pending = {orderNumber:data.orderNumber,token:data.paymentAccessToken!,total:data.total||0,method:paymentMethod,redirectUrl:data.redirectUrl,items:cartRows.map(({product,variant,quantity})=>({productId:product.id,variantIndex:product.variants.indexOf(variant),quantity})),fromCart:!new URLSearchParams(location.search).has('buy')};
      sessionStorage.setItem('sg_pending_payment',JSON.stringify(pending));
      setPending(pending);
      history.replaceState({},'', '/checkout?order_id='+encodeURIComponent(data.orderNumber));
      if (paymentMethod === 'midtrans') {
        if (!data.redirectUrl)
          throw new Error('Link pembayaran belum tersedia.');
        window.location.assign(data.redirectUrl);
        return;
      }

    } catch (error) {
      setOrderError(
        error instanceof Error ? error.message : 'Pesanan gagal disimpan.',
      );
    } finally {
      setOrderBusy(false);
    }
  }

 return <main className="min-h-screen bg-[#f5f6f4] text-[#17251c]"><header className="border-b bg-white"><div className="mx-auto max-w-5xl px-5 py-5 font-serif text-2xl font-bold">simple ground. <span className="ml-3 font-sans text-base font-medium">Pembayaran</span></div></header>
 <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
 <section role="status" aria-labelledby="payment-maintenance-title" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:p-5">
  <h2 id="payment-maintenance-title" className="text-base font-semibold">Pemeliharaan pembayaran QRIS &amp; Virtual Account</h2>
  <p className="mt-2 text-sm leading-6 sm:text-base">Pembayaran QRIS dan Virtual Account sedang dalam pemeliharaan. Untuk sementara, kami menyarankan Anda memilih transfer manual Bank Mandiri. Pembayaran manual akan dikonfirmasi oleh admin.</p>
 </section>
 {loading?<p role="status">Memuat pembayaran…</p>:pending?<section className="mx-auto max-w-xl rounded-2xl border bg-white p-6 sm:p-8"><h1 className="text-2xl font-semibold">Pesanan {pending.orderNumber}</h1><p role="status" className="mt-4 leading-7">{status}</p><p className="mt-5 text-2xl font-bold">{rupiah(pending.total)}</p>{pending.method==='manual'?<div className="mt-5 rounded-xl bg-slate-50 p-5"><p>Transfer Bank Mandiri</p><b className="my-2 block text-xl">9000027694984</b><p>a.n. Muhammad Arifin</p><p className="mt-3 text-sm">Pembayaran manual menunggu konfirmasi admin.</p></div>:!cancelled&&pending.redirectUrl&&<a className="mt-5 block rounded-xl bg-[#173c2b] p-4 text-center font-semibold text-white" href={pending.redirectUrl}>Lanjutkan pembayaran</a>}<a className="mt-5 block text-sm underline" href={'https://wa.me/6285172381996?text='+encodeURIComponent('Halo, mohon bantu cek pembayaran pesanan '+pending.orderNumber)}>Konfirmasi / bantuan WhatsApp</a>{cancelled&&<button className="mt-5 rounded-xl border p-3" onClick={()=>{sessionStorage.removeItem('sg_pending_payment');location.replace('/checkout');}}>Ulangi checkout</button>}</section>:!cartRows.length?<section className="rounded-2xl border bg-white p-6"><p>{orderError||'Belum ada produk untuk dibayar.'}</p><a href="/#koleksi" className="mt-4 inline-block underline">Kembali ke katalog</a></section>:<><a href="/#koleksi" className="mb-5 inline-block text-sm underline">← Kembali belanja</a><div className="grid items-start gap-6 md:grid-cols-[1fr_1.35fr]"><section className="rounded-2xl border bg-white p-5"><h1 className="mb-5 text-xl font-semibold">Ringkasan pesanan</h1><div className="space-y-5">{cartRows.map(row=><div key={row.key} className="flex gap-3"><img src={row.product.images?.[0]||row.product.image||'/placeholder-product.svg'} alt="" className="h-20 w-16 rounded-lg object-cover"/><div><b>{row.product.name}</b><p className="mt-1 text-sm">{row.variant.color} · {row.variant.size} × {row.quantity}</p><p className="mt-1 text-sm text-[#276344]">{preorderLabel(row.product,row.variant)}</p><p className="mt-2 font-semibold">{rupiah(row.variant.price*row.quantity)}</p></div></div>)}</div><p className="mt-5 text-sm text-slate-500">Pesanan campuran dikirim bersama setelah seluruh produk siap. Waktu pre-order belum termasuk pengiriman kurir.</p></section><section className="rounded-2xl border bg-white">              <div className="flex-1 overflow-auto p-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider">
                    Nama lengkap
                  </label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="mt-2 w-full rounded-xl border bg-white px-4 py-3 outline-none"
                    placeholder="Nama penerima"
                  />
                </div>
                <div className="mt-4">
                  <label className="text-xs font-bold uppercase tracking-wider">
                    Nomor WhatsApp
                  </label>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    inputMode="tel"
                    className="mt-2 w-full rounded-xl border bg-white px-4 py-3 outline-none"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
                <div className="mt-4">
                  <label className="text-xs font-bold uppercase tracking-wider">
                    Alamat pengiriman
                  </label>
                  <textarea
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="mt-2 min-h-24 w-full rounded-xl border bg-white px-4 py-3 outline-none"
                    placeholder="Jalan, kecamatan, kota, kode pos"
                  />
                </div>
                <div className="mt-4">
                  <label className="text-xs font-bold uppercase tracking-wider">
                    Kode pos tujuan
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={destinationPostalCode}
                      onChange={(event) => {
                        setDestinationPostalCode(
                          event.target.value.replace(/\D/g, '').slice(0, 5),
                        );
                        setShippingOptions([]);
                        setSelectedShipping(null);
                      }}
                      inputMode="numeric"
                      placeholder="5 digit"
                      className="min-w-0 flex-1 rounded-xl border bg-white px-4 py-3 outline-none"
                    />
                    <button
                      type="button"
                      onClick={checkShippingRates}
                      disabled={
                        shippingBusy || destinationPostalCode.length !== 5
                      }
                      className="rounded-xl bg-[#173c2b] px-4 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {shippingBusy ? 'Memeriksa…' : 'Cek ongkir'}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-[#758078]">
                    Masukkan 5 digit kode pos lalu tekan Cek ongkir. Dalam mode
                    Sandbox, harga yang bertanda estimasi belum merupakan tarif
                    kurir sungguhan.
                  </p>
                  {shippingError && (
                    <p className="mt-2 text-sm text-red-700">{shippingError}</p>
                  )}
                  {shippingOptions.length > 0 && (
                    <div className="mt-3 max-h-52 space-y-2 overflow-auto">
                      {shippingOptions.map((option) => {
                        const key = `${option.courierCode}:${option.serviceCode}`;
                        const selected =
                          selectedShipping?.courierCode ===
                            option.courierCode &&
                          selectedShipping?.serviceCode === option.serviceCode;
                        return (
                          <label
                            key={key}
                            className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 ${selected ? 'border-[#243b2c] bg-[#edf1e9]' : 'bg-white'}`}
                          >
                            <span className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="shipping"
                                checked={selected}
                                onChange={() => setSelectedShipping(option)}
                                className="accent-[#243b2c]"
                              />
                              <span>
                                <b className="block text-sm">
                                  {option.courierName} {option.serviceName}
                                </b>
                                <span className="text-xs text-[#637067]">
                                  {option.duration ||
                                    'Estimasi mengikuti kurir'}
                                </span>
                              </span>
                            </span>
                            <b className="shrink-0 text-sm">
                              {rupiah(option.price)}
                            </b>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Pembayaran
                  </p>
                  <div className="mt-2 space-y-2">
                    <label
                      className={`block cursor-pointer rounded-2xl border p-4 transition ${paymentMethod === 'midtrans' ? 'border-[#243b2c] bg-[#edf1e9]' : 'bg-white'}`}
                    >
                      <span className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="payment"
                          checked={paymentMethod === 'midtrans'}
                          onChange={() => setPaymentMethod('midtrans')}
                          className="mt-1 accent-[#243b2c]"
                        />
                        <span>
                          <b>QRIS & Virtual Account</b>
                          <span className="mt-1 block text-sm text-[#637067]">
                            Sedang dalam pemeliharaan. Silakan pilih transfer
                            manual Bank Mandiri untuk sementara.
                          </span>
                          <span className="mt-2 inline-block rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#24593d]">
                            Sedang dalam pemeliharaan
                          </span>
                        </span>
                      </span>
                    </label>
                    <label
                      className={`block cursor-pointer rounded-2xl border p-4 transition ${paymentMethod === 'manual' ? 'border-[#243b2c] bg-[#edf1e9]' : 'bg-white'}`}
                    >
                      <span className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="payment"
                          checked={paymentMethod === 'manual'}
                          onChange={() => setPaymentMethod('manual')}
                          className="mt-1 accent-[#243b2c]"
                        />
                        <span>
                          <b>Transfer manual Bank Mandiri — direkomendasikan</b>
                          <span className="mt-1 block text-sm text-[#637067]">
                            Pilih opsi ini selama pemeliharaan QRIS dan Virtual Account. Informasi rekening muncul setelah pesanan dibuat. Konfirmasikan pembayaran melalui WhatsApp.
                          </span>
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
                <div className="mt-6 rounded-2xl bg-[#f1ecdf] p-4 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{rupiah(subtotal)}</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span>Pengiriman</span>
                    <span>
                      {selectedShipping ? rupiah(shipping) : 'Pilih kurir'}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-between border-t pt-3 font-bold">
                    <span>Total</span>
                    <span>{rupiah(subtotal + shipping)}</span>
                  </div>
                </div>
                <button
                  onClick={submitOrder}
                  disabled={
                    orderBusy || !cartRows.length ||
                    customerName.trim().length < 2 ||
                    customerPhone.trim().length < 8 ||
                    shippingAddress.trim().length < 10 ||
                    !selectedShipping
                  }
                  className="mt-5 w-full rounded-full bg-[#c0693c] py-3.5 font-semibold text-white disabled:opacity-60"
                >
                  {orderBusy
                    ? 'Menyiapkan pembayaran…'
                    : paymentMethod === 'midtrans'
                      ? 'Lanjut bayar QRIS / Virtual Account'
                      : 'Buat pesanan & lihat rekening'}
                </button>
                {orderError && (
                  <p className="mt-3 text-center text-sm text-red-700">
                    {orderError}
                  </p>
                )}
                <p className="mt-3 text-center text-[11px] leading-4 text-[#758078]">
                  Pembayaran otomatis diproses aman oleh Midtrans. Simple Ground
                  tidak menyimpan data kartu atau PIN pembayaran Anda.
                </p>
              </div></section></div></>}</div></main>;
}

