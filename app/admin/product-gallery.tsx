'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
type Photo={id:string;url:string;file?:File;savedIndex?:number};
export function ProductGallery({initial=[]}:{initial?:string[]}) {
  const [photos,setPhotos]=useState<Photo[]>(()=>initial.filter(url=>url!=='/placeholder-product.svg').map((url,index)=>({id:`saved-${index}`,url,savedIndex:index})));
  const [error,setError]=useState('');const input=useRef<HTMLInputElement>(null);const drag=useRef<string|null>(null);const urls=useRef<string[]>([]);
  useEffect(()=>()=>urls.current.forEach(url=>URL.revokeObjectURL(url)),[]);
  useEffect(()=>{
    const form=input.current?.form;if(!form)return;
    const handle=(event:Event)=>{const data=(event as FormDataEvent).formData;photos.filter(photo=>photo.file).forEach(photo=>data.append('images',photo.file!));};
    form.addEventListener('formdata',handle);return ()=>form.removeEventListener('formdata',handle);
  },[photos]);
  let newIndex=0;
  const order=photos.map(photo=>photo.file?`n:${newIndex++}`:`s:${photo.savedIndex}`);
  function move(id:string,target:number) {setPhotos(current=>{const from=current.findIndex(photo=>photo.id===id);if(from<0||target<0||target>=current.length)return current;const next=[...current];const [item]=next.splice(from,1);next.splice(target,0,item);return next;});}
  return <section className="rounded-xl border bg-white p-5 sm:col-span-2"><input type="hidden" name="galleryOrder" value={JSON.stringify(order)}/><h3 className="font-semibold">Foto produk <span className="text-sm font-normal text-slate-500">({photos.length}/9)</span></h3><p className="mt-1 text-sm text-slate-500">Geser foto untuk mengubah urutan. Foto pertama menjadi cover. Gunakan tombol panah pada ponsel atau keyboard.</p><input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Upload foto produk" className="my-4 block w-full text-sm" onChange={event=>{
    const files=Array.from(event.target.files||[]);event.target.value='';
    if(photos.length+files.length>9){setError('Maksimal 9 foto. Hapus foto yang tidak diperlukan dahulu.');return;}
    if(files.some(file=>file.size>5e6||!['image/jpeg','image/png','image/webp'].includes(file.type))){setError('Gunakan JPG, PNG, atau WebP maksimal 5 MB per foto.');return;}
    setPhotos(current=>[...current,...files.map(file=>{const url=URL.createObjectURL(file);urls.current.push(url);return {id:crypto.randomUUID(),url,file};})]);setError('');
  }}/>{error&&<p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{photos.map((photo,index)=><div key={photo.id} draggable onDragStart={event=>{drag.current=photo.id;event.dataTransfer.effectAllowed='move';}} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(drag.current)move(drag.current,index);drag.current=null;}} onDragEnd={()=>{drag.current=null;}} className="overflow-hidden rounded-lg border bg-slate-50"><div className="relative"><img draggable={false} src={photo.url} alt={`Foto produk ${index+1}`} className="aspect-square w-full object-cover"/><span className={`absolute left-2 top-2 rounded px-2 py-1 text-xs font-semibold ${index===0?'bg-blue-600 text-white':'bg-white text-slate-700'}`}>{index===0?'Cover utama':`Foto ${index+1}`}</span></div><div className="flex items-center justify-between p-1"><Button type="button" variant="ghost" size="sm" disabled={index===0} aria-label={`Pindah foto ${index+1} ke kiri`} onClick={()=>move(photo.id,index-1)}>←</Button><Button type="button" variant="ghost" size="sm" aria-label={`Hapus foto ${index+1}`} onClick={()=>setPhotos(current=>current.filter(item=>item.id!==photo.id))}>Hapus</Button><Button type="button" variant="ghost" size="sm" disabled={index===photos.length-1} aria-label={`Pindah foto ${index+1} ke kanan`} onClick={()=>move(photo.id,index+1)}>→</Button></div></div>)}</div><p className="mt-3 text-xs text-slate-500">Penghapusan dan urutan foto berlaku setelah Simpan produk.</p></section>;
}
