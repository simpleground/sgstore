export type EditorVariant = { sku?: string; color: string; size: string; normalPrice?: number; discountPercent?: number; price: number; stock: number; attributes?: Record<string,string> };
export type VariantAxis = { name:string; values:string[] };
export const variantKey = (attributes:Record<string,string>) => JSON.stringify(Object.entries(attributes).sort(([a],[b])=>a.localeCompare(b)));
export function inferAxes(rows:EditorVariant[]):VariantAxis[] {
  if(!rows.length) return [{name:'Ukuran',values:[]},{name:'Warna',values:[]}];
  const names = rows[0].attributes ? Object.keys(rows[0].attributes) : ['Ukuran','Warna'];
  return names.map(name=>({name,values:Array.from(new Set(rows.map(row=>row.attributes?.[name] ?? (name==='Ukuran'?row.size:row.color))))}));
}
export function combinations(axes:VariantAxis[],previous:EditorVariant[]):EditorVariant[] {
  if(!axes.length || axes.some(axis=>!axis.values.length)) return [];
  if(axes.reduce((n,axis)=>n*axis.values.length,1)>500) throw new Error('Maksimal 500 kombinasi per produk.');
  const existing=new Map(previous.map(row=>[variantKey(row.attributes ?? {Ukuran:row.size,Warna:row.color}),row]));
  const values=axes.reduce<Record<string,string>[]>((list,axis)=>list.flatMap(item=>axis.values.map(value=>({...item,[axis.name]:value}))),[{}]);
  return values.map(attributes=>existing.get(variantKey(attributes)) ?? {attributes,sku:'',size:attributes.Ukuran || 'All Size',color:Object.entries(attributes).filter(([name])=>name!=='Ukuran').map(([name,value])=>name==='Warna'?value:`${name}: ${value}`).join(' / ') || 'Default',normalPrice:0,price:0,stock:0,discountPercent:0});
}
export function applyVariantBulk(rows:EditorVariant[],selected:number[]|null,price:string,stock:string) {
  if((price!==''&&(!Number.isSafeInteger(Number(price))||Number(price)<1))||(stock!==''&&(!Number.isSafeInteger(Number(stock))||Number(stock)<0))) throw new Error('Harga harus angka bulat positif; stok minimal 0.');
  return rows.map((row,index)=>selected&&!selected.includes(index)?row:{...row,...(price!==''?{price:Number(price),normalPrice:Number(price),discountPercent:0}:{}),...(stock!==''?{stock:Number(stock)}:{})});
}
export function validateVariants(value:unknown):EditorVariant[] {
  if(!Array.isArray(value)||!value.length||value.length>500)throw new Error('Isi 1–500 varian produk.');
  const skus=new Set<string>();const combinationsSeen=new Set<string>();
  return value.map((row:EditorVariant)=>{
    if(!row || typeof row.color!=='string'||!row.color.trim()||typeof row.size!=='string'||!row.size.trim()||!Number.isSafeInteger(row.price)||row.price<1||!Number.isSafeInteger(row.stock)||row.stock<0||!Number.isSafeInteger(row.normalPrice ?? row.price)||(row.normalPrice ?? row.price)<row.price)throw new Error('Periksa harga dan stok varian. Gunakan angka bulat; harga harus lebih dari nol.');
    if(row.attributes && (typeof row.attributes!=='object'||Array.isArray(row.attributes)||Object.entries(row.attributes).some(([key,v])=>!key.trim()||typeof v!=='string'||!v.trim())))throw new Error('Jenis dan nilai varian tidak valid.');
    const sku=String(row.sku || '').trim();
    if(sku&&skus.has(sku.toLowerCase()))throw new Error(`SKU ${sku} digunakan lebih dari sekali.`);
    if(sku)skus.add(sku.toLowerCase());
    const key=variantKey(row.attributes ?? {Ukuran:row.size,Warna:row.color});
    if(combinationsSeen.has(key))throw new Error('Kombinasi varian tidak boleh sama.');combinationsSeen.add(key);
    return {...row,sku,normalPrice:row.normalPrice ?? row.price};
  });
}
export function resolveGallery(order:unknown,previous:string[],uploaded:string[]) {
  if(!Array.isArray(order)||order.length>9)throw new Error('Maksimal 9 foto per produk.');
  const seen=new Set<string>();
  return order.map(ref=>{
    if(typeof ref!=='string'||!/^([sn]):\d+$/.test(ref)||seen.has(ref))throw new Error('Urutan foto tidak valid.');seen.add(ref);
    const [kind,index]=ref.split(':');const value=(kind==='s'?previous:uploaded)[Number(index)];
    if(!value)throw new Error('Foto tidak ditemukan. Muat ulang produk.');return value;
  });
}
export const productImageUrl=(key:string)=>/^https?:\/\//.test(key)?key:`/api/product-image/${key}`;
