let db;
export const BACKUP_VERSION=1;
export const uid=()=>crypto.randomUUID();
export function init(name='openclose'){return new Promise((res,rej)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{r.result.createObjectStore('models',{keyPath:'id'});r.result.createObjectStore('convs',{keyPath:'id'})};r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>rej(r.error)})}
const rq=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const st=(s,m='readonly')=>db.transaction(s,m).objectStore(s);
export const getAll=s=>rq(st(s).getAll());
export const get=(s,k)=>rq(st(s).get(k));
export const put=(s,v)=>rq(st(s,'readwrite').put(v));
export const del=(s,k)=>rq(st(s,'readwrite').delete(k));
const done=t=>new Promise((res,rej)=>{t.oncomplete=res;t.onerror=t.onabort=()=>rej(t.error)});
export async function clearAll(){const t=db.transaction(['models','convs'],'readwrite');t.objectStore('models').clear();t.objectStore('convs').clear();await done(t)}
export async function exportAll(includeKeys=false){const models=(await getAll('models')).map(m=>includeKeys?m:{...m,key:''});
 return{app:'openclose',version:BACKUP_VERSION,exported:new Date().toISOString(),includesKeys:!!includeKeys,models,convs:await getAll('convs')}}
export function validateBackup(d){const e=[],s=v=>typeof v==='string';
 if(!d||typeof d!=='object'||Array.isArray(d))return{ok:false,errors:['Not an OpenClose backup object'],counts:{models:0,convs:0,msgs:0}};
 if(d.app!=='openclose')e.push('Not an OpenClose backup');
 if(!Number.isInteger(d.version)||d.version<1)e.push('Missing or invalid version');else if(d.version>BACKUP_VERSION)e.push(`Backup version ${d.version} is newer than this app supports (${BACKUP_VERSION})`);
 let msgs=0;
 if(!Array.isArray(d.models)||!Array.isArray(d.convs))e.push('"models" and "convs" must be arrays');
 else{const ids=new Set();
  d.models.forEach((m,i)=>{if(!m||!s(m.id)||!s(m.name)||!s(m.model)||!s(m.base))e.push(`models[${i}] is malformed`)});
  d.convs.forEach((c,i)=>{if(!c||!s(c.id)||!s(c.title)||!Array.isArray(c.msgs)){e.push(`convs[${i}] is malformed`);return}
   if(ids.has(c.id))e.push(`Duplicate conversation id ${c.id}`);ids.add(c.id);msgs+=c.msgs.length;
   c.msgs.forEach((m,j)=>{if(!m||!['user','assistant','notice'].includes(m.role)||!s(m.content))e.push(`convs[${i}].msgs[${j}] is malformed`)});
   if(c.boundary!=null&&!(Number.isInteger(c.boundary)&&c.boundary>=0&&c.boundary<=c.msgs.length))e.push(`convs[${i}] has an invalid context boundary`)})}
 return{ok:!e.length,errors:e.slice(0,10),counts:{models:d.models?.length||0,convs:d.convs?.length||0,msgs}}}
export async function importBackup(d,mode){const v=validateBackup(d);if(!v.ok)throw new Error('Invalid backup: '+v.errors[0]);
 const mi=new Map((await getAll('models')).map(x=>[x.id,x])),ci=new Map((await getAll('convs')).map(x=>[x.id,x]));
 const t=db.transaction(['models','convs'],'readwrite'),M=t.objectStore('models'),C=t.objectStore('convs');let added=0,updated=0,skipped=0;
 if(mode==='replace'){M.clear();C.clear()}
 for(const m of d.models){if(mode==='merge'&&mi.has(m.id)){skipped++;continue}M.put(m);added++}
 for(const c of d.convs){const o=mode==='merge'&&ci.get(c.id);if(o&&(o.updated||0)>=(c.updated||0)){skipped++;continue}o?updated++:added++;C.put({...c,boundary:c.boundary||0})}
 await done(t);return{added,updated,skipped}}
export class SSEParser{constructor(on){this.b='';this.on=on}
 push(s){this.b=(this.b+s).replace(/\r\n/g,'\n');let i;while((i=this.b.indexOf('\n\n'))>=0){this.ev(this.b.slice(0,i));this.b=this.b.slice(i+2)}}
 end(){if(this.b.trim())this.ev(this.b);this.b=''}
 ev(raw){const data=raw.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).replace(/^ /,'')).join('\n');if(!data)return;
  if(data.trim()==='[DONE]')return this.on({done:true});let j;try{j=JSON.parse(data)}catch{return this.on({malformed:true})}
  if(j.error)return this.on({error:j.error.message||JSON.stringify(j.error)});
  const c=j.choices?.[0];this.on({delta:c?.delta?.content??c?.text??'',finish:c?.finish_reason||null,usage:j.usage})}}
export const buildMessages=(c,m)=>[...(m.sys?[{role:'system',content:m.sys}]:[]),...c.msgs.slice(c.boundary||0).filter(x=>x.role==='user'||(x.role==='assistant'&&x.content)).map(x=>({role:x.role,content:x.content}))];
export function explainError(e,{base=''}={}){const s=e?.status;
 if(s===401||s===403)return 'Authentication failed. Check the API key in this model profile.';
 if(s===404)return 'Endpoint or model not found. The base URL should normally end in /v1, and the backend model ID must match what the server serves.';
 if(s===429)return 'The server rate-limited the request. Wait a moment and retry.';
 if(s===400&&/context|too long|length/i.test(e.text||''))return 'The conversation exceeds the model context window. Clear context and retry.';
 if(s)return `Server returned HTTP ${s}. ${e.text||''}`.trim();
 if(e?.name==='TimeoutError')return 'Connection timed out.';
 if(e?.name==='TypeError'){const loc=typeof location!=='undefined'?location:{protocol:'',origin:'this site'};
  if(loc.protocol==='https:'&&/^http:\/\/(?!localhost|127\.|\[::1\])/.test(base))return `This page uses HTTPS but ${base} is plain HTTP, so the browser blocks it (mixed content). Use an HTTPS endpoint or tunnel.`;
  return `The browser could not reach ${base}. Either the server is down, or it does not allow browser (CORS) requests from ${loc.origin}. Allow this origin on the server (e.g. OLLAMA_ORIGINS for Ollama, the CORS switch in LM Studio, --allowed-origins for vLLM). No backend proxy is used.`}
 return e?.message||'Unknown error'}
