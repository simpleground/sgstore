export function availableSizes(variants: {size:string;stock:number}[]) {
  const sizes = Array.from(new Set(variants.filter(v=>v.stock>=0).map(v=>v.size.trim().toUpperCase().replace(/^XXL$/, '2XL').replace(/^XXXL$/, '3XL').replace(/^XXXXL$/, '4XL')).filter(Boolean)));
  if (!sizes.length) return 'Stok habis';
  if (sizes.length===1) return sizes[0]==='ALL SIZE'?'All Size':sizes[0];
  const order=['XXS','XS','S','M','L','XL',...Array.from({length:19},(_,i)=>`${i+2}XL`)];
  if(sizes.every(size=>order.includes(size))) {
    sizes.sort((a,b)=>order.indexOf(a)-order.indexOf(b));
    return `${sizes[0]} – ${sizes[sizes.length-1]}`;
  }
  return sizes.sort((a,b)=>a.localeCompare(b,'id',{numeric:true})).join(' / ');
}
