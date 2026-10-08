import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const compile=async path=>ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const helper={};vm.runInNewContext(await compile('../src/utils/masterData.ts'),{exports:helper});
const code=await compile('../src/app/actions/master.ts');
function scenario({signedIn=true,owned=true,existing=0,fail=false}={}){
 const dbRows=new Map(Array.from({length:existing},(_,i)=>[String(i),{employee_id:String(i),name:'original',email:'old@example.com'}]));
 const writes=[];
 const db={auth:{getUser:async()=>({data:{user:signedIn?{id:'owner'}:null}})},from(table){
  if(table==='tenants')return {select(){return this},eq(key,value){assert.equal(key,'owner_id');assert.equal(value,'owner');return this},async single(){return {data:owned?{id:'tenant'}:null}}};
  assert.equal(table,'master_data');return {
   async insert(row){writes.push(row);if(dbRows.has(row.employee_id))return {error:{code:'23505'}};dbRows.set(row.employee_id,row);return {error:null}},
   async upsert(rows,options){assert.equal(options.ignoreDuplicates,true);assert.equal(options.onConflict,'tenant_id,employee_id');assert.equal(options.count,'exact');if(fail)return {error:{code:'FAIL'},count:null};let count=0;for(const row of rows){assert.equal(row.tenant_id,'tenant');writes.push(row);if(!dbRows.has(row.employee_id)){dbRows.set(row.employee_id,row);count++}}return {error:null,count};}
  };
 }};
 const exports={};vm.runInNewContext(code,{exports,require:name=>name==='@/utils/masterData'?helper:{createClient:async()=>db},console:{error(){},warn(){},log(){}}});return {...exports,dbRows,writes};
}
const member=id=>({employee_id:String(id),name:'new name',email:'new@example.com'});
test('full CSV over 1000 existing members adds only newcomers and repeated import is idempotent',async()=>{
 const s=scenario({existing:2747});const rows=Array.from({length:2750},(_,i)=>member(i));
 let result=await s.importMasterDataCSV(rows);assert.equal(result.inserted,3);assert.equal(result.skipped,2747);assert.equal(s.dbRows.get('2000').email,'old@example.com');
 result=await s.importMasterDataCSV(rows);assert.equal(result.inserted,0);assert.equal(result.skipped,2750);
});
test('duplicate IDs within CSV are deduplicated; conflicting values reject the entire import',async()=>{
 const s=scenario();const result=await s.importMasterDataCSV([member('001'),member('001')]);assert.equal(result.inserted,1);assert.equal(result.skipped,1);assert.ok(s.dbRows.has('001'));
 const before=s.writes.length;assert.equal((await s.importMasterDataCSV([member('002'),{...member('002'),email:'other@example.com'}])).success,false);assert.equal(s.writes.length,before);
});
test('unauthenticated and unowned requests cannot write',async()=>{
 for(const options of [{signedIn:false},{owned:false}]){const s=scenario(options);assert.equal((await s.importMasterDataCSV([member(1)])).success,false);assert.equal(s.writes.length,0)}
});
test('invalid rows fail without partially importing other valid rows',async()=>{
 for(const bad of [{employee_id:'',name:'test'}, {...member(1),email:'bad-email'},null]){const s=scenario();assert.equal((await s.importMasterDataCSV([member(2),bad])).success,false);assert.equal(s.writes.length,0)}
});
test('individual add never overwrites an existing member and can retry a new ID',async()=>{
 const s=scenario({existing:1});const form=row=>({get:key=>row[key]});assert.equal((await s.addMasterDataRecord(form(member(0)))).success,false);assert.equal(s.dbRows.get('0').email,'old@example.com');assert.equal((await s.addMasterDataRecord(form(member('0001')))).success,true);
});
test('database failure is reported instead of a successful import',async()=>{
 const s=scenario({fail:true});assert.equal((await s.importMasterDataCSV([member(1)])).success,false);assert.equal(s.dbRows.size,0);
});
