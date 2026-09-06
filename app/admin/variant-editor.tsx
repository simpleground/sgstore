'use client';
import {useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {combinations,inferAxes,variantKey,applyVariantBulk,type EditorVariant,type VariantAxis} from '@/lib/product-editor';

export function VariantEditor({initial=[]}:{initial?:EditorVariant[]}) {
  const [axes,setAxes]=useState(()=>inferAxes(initial));
  const [rows,setRows]=useState(initial);
  const cache=useRef(initial);
  const [drafts,setDrafts]=useState<Record<number,string>>({});
  const [newType,setNewType]=useState('');
  const [selected,setSelected]=useState<number[]>([]);
  const [scope,setScope]=useState('all');
  const [price,setPrice]=useState('');const [stock,setStock]=useState('');
  const [error,setError]=useState('');
  function regenerate(next:VariantAxis[]) {
    try {
      const known=new Map(cache.current.map(row=>[variantKey(row.attributes??{Ukuran:row.size,Warna:row.color}),row]));
      rows.forEach(row=>known.set(variantKey(row.attributes??{Ukuran:row.size,Warna:row.color}),row));
      cache.current=[...known.values()];
      const result=combinations(next,cache.current);setAxes(next);setRows(result);setSelected([]);setError('');
    }catch(e){setError((e as Error).message);}
  }
  function addValues(index:number) {
    const values=(drafts[index]||'').split(/[,\n]/).map(v=>v.trim()).filter(Boolean);
    regenerate(axes.map((axis,i)=>i===index?{...axis,values:Array.from(new Set([...axis.values,...values]))}:axis));
    setDrafts({...drafts,[index]:''});
  }
  function change(index:number,field:'sku'|'normalPrice'|'discountPercent'|'price'|'stock',value:string) {
    setRows(current=>current.map((row,i)=>{
      if(i!==index)return row;const next={...row,[field]:field==='sku'?value:Number(value)};
      if(field==='normalPrice'||field==='discountPercent')next.price=Math.round((next.normalPrice??next.price)*(1-(next.discountPercent??(1-row.price/(row.normalPrice||row.price))*100)/100));
      if(field==='price'){next.normalPrice=Math.max(next.normalPrice??0,next.price);next.discountPercent=next.normalPrice?100*(1-next.price/next.normalPrice):0;}
      return next;
    }));
  }
  function apply() {
    try {setRows(applyVariantBulk(rows,scope==='selected'?selected:null,price,stock));setError('');} catch(error){setError((error as Error).message);}
  }
  return <div className="rounded-xl border bg-white p-5 sm:col-span-2">
    <input type="hidden" name="variantsJson" value={JSON.stringify(rows)}/>
    <h3 className="text-base font-semibold">Variasi produk</h3><p className="mt-1 text-sm text-slate-500">Tambah nilai dipisahkan koma, lalu tekan Enter atau Tambahkan. Kombinasi dibuat otomatis.</p>
    <div className="my-4 space-y-4">{axes.map((axis,index)=><div key={axis.name} className="rounded-lg border p-3"><div className="mb-2 flex justify-between"><b className="text-sm">{axis.name}</b><Button type="button" variant="ghost" size="sm" onClick={()=>{if(rows.length&&!confirm('Hapus jenis varian ini? Kombinasi berubah dan data harga/SKU perlu diperiksa kembali.'))return;regenerate(axes.filter((_,i)=>i!==index));}}>Hapus jenis</Button></div><div className="mb-3 flex flex-wrap gap-2">{axis.values.map(value=><span key={value} className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1 text-sm text-blue-700">{value}<button type="button" aria-label={`Hapus ${axis.name} ${value}`} onClick={()=>{if(!confirm(`Hapus nilai ${value} beserta kombinasinya?`))return;regenerate(axes.map((a,i)=>i===index?{...a,values:a.values.filter(v=>v!==value)}:a));}}>×</button></span>)}</div><div className="flex gap-2"><Input aria-label={`Nilai ${axis.name}`} placeholder={axis.name==='Ukuran'?'S, M, L, XL, 2XL':'Hitam, Putih, Navy'} value={drafts[index]||''} onChange={event=>setDrafts({...drafts,[index]:event.target.value})} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addValues(index);}}}/><Button type="button" variant="outline" onClick={()=>addValues(index)}>Tambahkan</Button></div></div>)}</div>
    <div className="flex gap-2"><Input aria-label="Jenis varian baru" placeholder="Jenis varian baru, misalnya Bahan" value={newType} onChange={event=>setNewType(event.target.value)}/><Button type="button" variant="outline" disabled={!newType.trim()||axes.some(a=>a.name.toLowerCase()===newType.trim().toLowerCase())||axes.length>=3} onClick={()=>{regenerate([...axes,{name:newType.trim(),values:[]}]);setNewType('');}}>Tambah jenis</Button></div>
    <div className="my-5 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2"><label className="text-sm">Harga jual massal<Input type="number" min="1" step="1" value={price} placeholder="Kosongkan jika tidak diubah" onChange={e=>setPrice(e.target.value)}/></label><label className="text-sm">Stok massal<Input type="number" min="0" step="1" value={stock} placeholder="Kosongkan jika tidak diubah" onChange={e=>setStock(e.target.value)}/></label><select aria-label="Sasaran penerapan massal" value={scope} onChange={e=>setScope(e.target.value)} className="rounded-lg border bg-white p-2"><option value="all">Semua varian ({rows.length})</option><option value="selected">Varian dipilih ({selected.length})</option></select><Button type="button" disabled={!rows.length||(scope==='selected'&&!selected.length)||(price===''&&stock==='')} onClick={apply}>Terapkan harga / stok</Button><p className="text-xs text-slate-500 sm:col-span-2">Harga massal menjadi harga normal dan harga jual; diskon pada varian sasaran direset ke 0%.</p></div>
    {error&&<p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
    <p className="mb-3 text-sm font-semibold">{rows.length} kombinasi · {selected.length} dipilih</p>
    {!rows.length?<p className="text-sm text-slate-500">Tambahkan nilai pada setiap jenis varian terlebih dahulu.</p>:<Table><TableHeader><TableRow><TableHead><input type="checkbox" aria-label="Pilih semua varian" checked={selected.length===rows.length} onChange={e=>setSelected(e.target.checked?rows.map((_,i)=>i):[])}/></TableHead><TableHead>Varian</TableHead><TableHead>SKU</TableHead><TableHead>Harga normal</TableHead><TableHead>Diskon %</TableHead><TableHead>Harga jual</TableHead><TableHead>Stok</TableHead></TableRow></TableHeader><TableBody>{rows.map((row,index)=><TableRow key={variantKey(row.attributes??{Ukuran:row.size,Warna:row.color})}><TableCell><input type="checkbox" aria-label={`Pilih varian ${index+1}`} checked={selected.includes(index)} onChange={e=>setSelected(e.target.checked?[...selected,index]:selected.filter(i=>i!==index))}/></TableCell><TableCell>{Object.values(row.attributes??{Ukuran:row.size,Warna:row.color}).join(' / ')}</TableCell><TableCell><Input className="min-w-32" aria-label={`SKU varian ${index+1}`} value={row.sku||''} onChange={e=>change(index,'sku',e.target.value)}/></TableCell>{(['normalPrice','discountPercent','price','stock'] as const).map(field=><TableCell key={field}><Input className="min-w-24" aria-label={`${field} varian ${index+1}`} required type="number" min={field==='stock'||field==='discountPercent'?0:1} max={field==='discountPercent'?99:undefined} step={field==='discountPercent'?'any':1} value={field==='discountPercent'?(row.discountPercent??(Math.round(100*(1-row.price/(row.normalPrice||row.price)))||0)):field==='normalPrice'?(row.normalPrice??row.price):row[field]} onChange={e=>change(index,field,e.target.value)}/></TableCell>)}</TableRow>)}</TableBody></Table>}
  </div>;
}
