import 'fake-indexeddb/auto';
import test from 'node:test';import assert from 'node:assert/strict';
import * as L from '../public/lib.js';
const conv=(id,n=2,u=1)=>({id,title:'t'+id,msgs:Array.from({length:n},(_,i)=>({role:i%2?'assistant':'user',content:'m'+i})),boundary:0,updated:u});
const mod=(id)=>({id,name:'N'+id,model:'x',base:'http://h/v1',key:'SECRET'});
test.before(()=>L.init('t'));
test('export omits keys by default and is versioned',async()=>{await L.put('models',mod('a'));await L.put('convs',conv('c1'));
 const b=await L.exportAll();assert.equal(b.version,1);assert.equal(b.models[0].key,'');assert.equal((await L.exportAll(true)).models[0].key,'SECRET')});
test('validation rejects bad backups and touches nothing',async()=>{
 for(const bad of [null,{app:'x'},{app:'openclose',version:9,models:[],convs:[]},{app:'openclose',version:1,models:[{id:1}],convs:[]},{app:'openclose',version:1,models:[],convs:[{id:'z',title:'t',msgs:[{role:'bot',content:'x'}]}]},{app:'openclose',version:1,models:[],convs:[{...conv('z'),boundary:99}]}])
  assert.equal(L.validateBackup(bad).ok,false);
 await assert.rejects(L.importBackup({app:'openclose',version:1,models:[],convs:[{id:1}]},'replace'));
 assert.equal((await L.getAll('convs')).length,1)});
test('merge keeps newer local data, adds new',async()=>{
 const r=await L.importBackup({app:'openclose',version:1,models:[mod('a'),mod('b')],convs:[conv('c1',4,0),conv('c2',2,5)]},'merge');
 assert.deepEqual(r,{added:2,updated:0,skipped:2});assert.equal((await L.get('convs','c1')).msgs.length,2)});
test('replace swaps everything',async()=>{await L.importBackup({app:'openclose',version:1,models:[mod('z')],convs:[conv('c9')]},'replace');
 assert.deepEqual((await L.getAll('models')).map(m=>m.id),['z']);assert.deepEqual((await L.getAll('convs')).map(c=>c.id),['c9'])});
test('clearAll empties stores',async()=>{await L.clearAll();assert.equal((await L.getAll('convs')).length+(await L.getAll('models')).length,0)});
test('context boundary really changes payload',()=>{const c=conv('q',4);c.msgs.splice(2,0,{role:'notice',content:'cleared'});c.boundary=3;
 const m=L.buildMessages(c,{sys:'S'});assert.deepEqual(m.map(x=>x.role+':'+x.content),['system:S','user:m2','assistant:m3']);
 c.boundary=0;assert.equal(L.buildMessages(c,{}).length,4)});
test('SSE: split chunks, CRLF, multi-event, malformed, DONE',()=>{const ev=[];const p=new L.SSEParser(e=>ev.push(e));
 const raw='data: {"choices":[{"delta":{"content":"He"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"llo"},"finish_reason":"length"}]}\n\ndata: {bad\n\ndata: [DONE]\n\n';
 for(let i=0;i<raw.length;i+=7)p.push(raw.slice(i,i+7));p.end();
 assert.equal(ev.filter(e=>e.delta).map(e=>e.delta).join(''),'Hello');assert.ok(ev.some(e=>e.finish==='length'));assert.ok(ev.some(e=>e.malformed));assert.ok(ev.some(e=>e.done))});
test('error explanations',()=>{assert.match(L.explainError({status:401}),/Authentication/);assert.match(L.explainError(new TypeError('x'),{base:'http://h/v1'}),/CORS/);assert.match(L.explainError({status:400,text:'context length'}),/context window/)});
