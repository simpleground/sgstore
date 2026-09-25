const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
function moduleFrom(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code, {exports, require: name => dependencies[name], Response, URL, crypto: require('node:crypto').webcrypto});
  return exports;
}
const csv = moduleFrom('lib/catalog-csv.ts');
assert.equal(csv.csvRecords('a;b\r\n"ukuran\nM;L";2\r\n').length, 2);
assert.throws(() => csv.csvRecords('"unfinished'));
let batches = [];
const products = [{id:'one',name:'Kaos',category:'Daily Basic',subcategory:'Kaos',active:1,material:'Katun',weight_grams:500,sold_count:4,variants_json:JSON.stringify([{color:'Hitam',size:'M',price:10000,normalPrice:10000,stock:5}])}, {id:'two',name:'Kemeja',variants_json:'[]'}];
const db = {prepare(sql) { return {sql, values:[], bind(...values) {this.values=values; return this;}, async first(){return {user_id:'admin'};}, async all(){return {results:products};}};}, async batch(s){batches.push(...s);}};
const api = moduleFrom('app/api/admin/products/bulk/route.ts', {'next/server':{NextResponse:{json:(d,o)=>new Response(JSON.stringify(d),o)}}, '@/lib/admin-auth':{authorizeStore:async()=>({ok:true,admin:{store:{id:'default'}}}),adminCan:()=>true},'@/lib/audit':{audit:async()=>{}}, '@/db':{getD1:()=>db}, '@/lib/catalog-normalize':moduleFrom('lib/catalog-normalize.ts')});
const base = {product_id:'one',name:'Kaos',category:'Daily Basic',subcategory:'Kaos',description:'Deskripsi',color:'Hitam',size:'M',sku:'A',normal_price:10000,discount_percent:0,stock:5};
async function post(rows,preview=false){return api.POST({json:async()=>({rows,preview})});}
(async()=>{
 const exported=await (await api.GET({url:'https://test/api?id=one'})).text(); assert(exported.includes('material')); assert(exported.includes('Katun')); assert(!exported.includes('Kemeja'));
 assert.equal((await post([{...base,weight_grams:-1}])).status,400);
 assert.equal((await post([{...base,sold_count:1.5}])).status,400);
 assert.equal((await post([{...base,material:'A'},{...base,sku:'B',size:'L',material:'B'}])).status,400);
 assert.equal((await post([{...base,material:'Katun',size_guide:'M\nL',weight_grams:350,sold_count:0}],true)).status,200); assert.equal(batches.length,0);
 assert.equal((await post([base])).status,200); assert.equal(batches[0].values[0],null); assert.equal(batches[0].values[4],null);
 batches=[]; assert.equal((await post([{...base,material:'Linen',weight_grams:350,sold_count:0}])).status,200); assert.equal(batches[0].values[0],'Linen'); assert.equal(batches[0].values[4],350); assert.equal(batches[0].values[5],0);
 console.log('PASS: CSV multiline, selected export, numeric validation, consistent variants, preview without writes, legacy preservation, updated fields.');
})().catch(e=>{console.error(e);process.exitCode=1;});
