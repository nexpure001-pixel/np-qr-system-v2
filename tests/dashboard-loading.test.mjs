import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const page = compile(await readFile(new URL('../src/app/admin/(protected)/page.tsx', import.meta.url), 'utf8'));
function render(view, requested='b') {
  const calls=[]; const exports={};
  const actions={getEvents:async()=>[{id:'a',email_template:'A'},{id:'b',email_template:'B'}],getEventStats:async id=>{calls.push(['stats',id]);return {eventId:id};},getEventParticipants:async id=>{calls.push(['participants',id]);return [{id:'person-'+id}];}};
  vm.runInNewContext(page,{exports,require:n=>n==='react/jsx-runtime'?{jsx:(_,props)=>props}:n.includes('actions/dashboard')?actions:{default:()=>{}}});
  return {calls,result:exports.default({searchParams:Promise.resolve({view,event:requested})})};
}
test('participant first render already contains selected event data and skips counts',async()=>{const s=render('participants');const p=await s.result;assert.equal(p.initialParticipants[0].id,'person-b');assert.deepEqual(s.calls,[['participants','b']]);assert.equal(p.initialStats,null);});
test('mail view receives its selected template without fetching all settings after mount',async()=>{const s=render('mail');const p=await s.result;assert.equal(p.initialTemplate,'B');assert.equal(p.initialParticipants[0].id,'person-b');});
test('history fetches neither participants nor counts; invalid event falls back to owned list',async()=>{const h=render('history');await h.result;assert.equal(h.calls.length,0);const s=render('overview','not-owned');const p=await s.result;assert.equal(p.initialStats.eventId,'a');assert.deepEqual(s.calls,[['stats','a']]);});
const actionCode=compile(await readFile(new URL('../src/app/actions/dashboard.ts',import.meta.url),'utf8'));
test('read actions still reject another owner before retrieving participants or counts',async()=>{
 const tables=[];const db={from:table=>{tables.push(table);const b={select:()=>b,eq:()=>b,single:async()=>({data:{id:'foreign',tenants:{owner_id:'other'}}})};return b;}};
 const exports={};vm.runInNewContext(actionCode,{exports,require:()=>({getAdminReadSession:async()=>({supabase:db,user:{id:'me'}})}),console});
 assert.equal(await exports.getEventStats('foreign'),null);assert.equal((await exports.getEventParticipants('foreign')).length,0);assert.deepEqual(tables,['events','events']);
});
