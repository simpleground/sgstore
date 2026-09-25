const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
function load(path,imports={}){const exports={};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,require:(key)=>imports[key]||require(key),Response,Request,FormData,File,crypto,console,process},{filename:path});return exports;}
const lib=load('lib/product-editor.ts');
const axes=[{name:'Ukuran',values:['S','M','L']},{name:'Warna',values:['Hitam','Putih']}];
const generated=lib.combinations(axes,[]);
assert.equal(generated.length,6);
assert.equal(generated.map(v=>`${v.size}/${v.color}`).join(','),'S/Hitam,S/Putih,M/Hitam,M/Putih,L/Hitam,L/Putih');
generated.forEach((v,i)=>Object.assign(v,{normalPrice:60000,price:54000,stock:10+i,sku:`SKU-${i}`}));
const expanded=lib.combinations([{...axes[0],values:['S','M','L','XL']},axes[1]],generated);
assert.equal(expanded[0].price,54000);assert.equal(expanded[5].sku,'SKU-5');assert.equal(expanded.length,8);
const partial=lib.applyVariantBulk(generated,[0,2],'72000','0');assert.equal(partial[0].price,72000);assert.equal(partial[0].stock,0);assert.equal(partial[1].price,54000);assert.equal(partial[1].sku,'SKU-1');
assert.equal(lib.applyVariantBulk(generated,null,'80000','20').every(v=>v.price===80000&&v.stock===20),true);
assert.throws(()=>lib.validateVariants([{...generated[0],price:NaN}]));
assert.throws(()=>lib.validateVariants([generated[0],{...generated[1],sku:'SKU-0'}]));
assert.throws(()=>lib.resolveGallery(['s:8'],['a'],[]));
assert.throws(()=>lib.resolveGallery(['s:0','s:0'],['a'],[]));
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE products(id TEXT PRIMARY KEY,name TEXT,category TEXT,subcategory TEXT,tone TEXT,price INTEGER,stock INTEGER,sold_count INTEGER,preorder_enabled INTEGER DEFAULT 0,preorder_days INTEGER DEFAULT 2,weight_grams INTEGER,description TEXT,material TEXT,care_instructions TEXT,production_estimate TEXT,size_guide TEXT,variants_json TEXT,image_key TEXT,image_url TEXT,images_json TEXT,active INTEGER,created_at TEXT,updated_at TEXT,deleted_at TEXT);CREATE TABLE admin_users(user_id TEXT);INSERT INTO admin_users VALUES('test');`);
const files=new Map();
const d1={prepare(sql){let params=[];return {bind(...args){params=args;return this;},async run(){return {meta:db.prepare(sql).run(...params)};},async first(){return db.prepare(sql).get(...params)||null;},async all(){return {results:db.prepare(sql).all(...params)};}};}};
const api=load('app/api/admin/products/route.ts',{'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},'@/lib/admin-auth':{isAdmin:async()=>true},'@/db':{getD1:()=>d1,getFiles:()=>({put:async(key,value)=>files.set(key,value)})},'@/lib/product-editor':lib,'@/lib/catalog-normalize':{normalizeCategory:v=>v,normalizeSubcategory:v=>v}});
function form(){const f=new FormData();for(const [key,value]of Object.entries({name:'Test Product',category:'Daily Basic',subcategory:'Kaos',description:'Test data',weightGrams:'250',sold_count:'0',variantsJson:JSON.stringify(generated),active:'true'}))f.set(key,value);return f;}
(async()=>{
const create=form();create.set('galleryOrder',JSON.stringify(['n:1','n:0']));create.append('images',new File(['one'],'one.jpg',{type:'image/jpeg'}));create.append('images',new File(['two'],'two.jpg',{type:'image/jpeg'}));
const response=await api.POST(new Request('https://test/api',{method:'POST',body:create}));const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));
const original=db.prepare('SELECT * FROM products WHERE id=?').get(result.id);const originalKeys=JSON.parse(original.images_json);assert.equal(originalKeys.length,2);assert.equal(original.image_key,originalKeys[0]);
assert.equal(original.preorder_enabled,0);assert.equal(original.preorder_days,2);
const edit=form();edit.set('preorder_enabled','1');edit.set('preorder_days','5');edit.set('id',result.id);edit.set('galleryOrder',JSON.stringify(['n:0','s:1']));edit.append('images',new File(['three'],'three.jpg',{type:'image/jpeg'}));
const saved=await api.PATCH(new Request('https://test/api',{method:'PATCH',body:edit}));assert.equal(saved.status,200,await saved.text());
const reopened=(await (await api.GET()).json()).products[0];assert.equal(reopened.images.length,2);assert.equal(reopened.images[1],lib.productImageUrl(originalKeys[1]));assert.ok(!reopened.images.includes(lib.productImageUrl(originalKeys[0])));assert.equal(reopened.image,reopened.images[0]);assert.equal(JSON.stringify(reopened.variants),JSON.stringify(generated));assert.equal(reopened.stock,75);assert.equal(reopened.price,54000);assert.equal(reopened.preorder_enabled,1);assert.equal(reopened.preorder_days,5);
const empty=form();empty.set('id',result.id);empty.set('galleryOrder','[]');assert.equal((await api.PATCH(new Request('https://test/api',{method:'PATCH',body:empty}))).status,200);const cleared=db.prepare('SELECT * FROM products WHERE id=?').get(result.id);assert.equal(cleared.image_key,null);assert.equal(cleared.image_url,null);assert.equal(cleared.images_json,'[]');
console.log('PASS: combination generation, preservation, validation, SQLite create/update/reopen, gallery reorder/remove/cover, and clearing all photos.');
db.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
