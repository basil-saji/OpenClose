import{init,getAll,get,put,del,clearAll,exportAll,validateBackup,importBackup,SSEParser,buildMessages,explainError,uid}from './lib.js';
const $=s=>document.querySelector(s);
const P={copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',dl:'<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',down:'<path d="M12 5v14m-6-6 6 6 6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',send:'<path d="M12 19V5m-6 6 6-6 6 6"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',cpu:'<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',eraser:'<path d="m7 21-4-4a2 2 0 0 1 0-3l10-10a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 9M7 21h13"/>',file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6"/>',redo:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8m0-5v5h-5"/>',dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',plus2:'<path d="M12 5v14M5 12h14"/>'};
const ic=n=>`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;
P.edit='<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';P.gear='<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let tt;const toast=t=>{const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(tt);tt=setTimeout(()=>e.style.display='none',2200)};
const EXT={python:'py',py:'py',javascript:'js',js:'js',typescript:'ts',ts:'ts',java:'java',c:'c',cpp:'cpp','c++':'cpp',json:'json',html:'html',css:'css',bash:'sh',sh:'sh',shell:'sh',sql:'sql',rust:'rs',go:'go'};
function md(el,text,final){el.innerHTML=DOMPurify.sanitize(marked.parse(text,{gfm:true,breaks:false}));
 el.querySelectorAll('pre').forEach(pre=>{const code=pre.querySelector('code')||pre;const raw=code.textContent;const lang=(([...code.classList].find(c=>c.startsWith('language-'))||'').slice(9)||'text').toLowerCase();
  const w=document.createElement('div');w.className='cb'+(raw.split('\n').length>28?' long':'');w.innerHTML=`<div class="h"><span>${esc(lang)}</span><button class="ib" data-a="c" aria-label="Copy code" title="Copy">${ic('copy')}</button><button class="ib" data-a="d" aria-label="Download code" title="Download">${ic('dl')}</button>${w.className.includes('long')?'<button class="btn" data-a="x" style="min-height:32px;padding:4px 8px;border:0;color:var(--t2)">Expand</button>':''}</div>`;
  pre.replaceWith(w);w.appendChild(pre);try{lang!=='text'&&hljs.getLanguage(lang)?hljs.highlightElement(code):0}catch{}
  w.querySelector('.h').onclick=async e=>{const a=e.target.closest('[data-a]')?.dataset.a;if(a==='c'){await navigator.clipboard.writeText(raw);toast('Code copied')}
   if(a==='d'){const u=URL.createObjectURL(new Blob([raw],{type:'text/plain'})),l=document.createElement('a');l.href=u;l.download='code.'+(EXT[lang]||'txt');l.click();URL.revokeObjectURL(u);toast('Downloaded code.'+(EXT[lang]||'txt'))}
   if(a==='x'){w.classList.toggle('open');e.target.textContent=w.classList.contains('open')?'Collapse':'Expand'}}});
 if(final||!/\$[^$]*$/.test(text))try{renderMathInElement(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false},{left:'$',right:'$',display:false}],throwOnError:false})}catch{}}

const S={models:[],convs:[],cur:null,busy:null,follow:true,err:'',drafts:{},prefs:{enterSend:true,font:15,...JSON.parse(localStorage.getItem('oc.prefs')||'{}')}};
const savePrefs=()=>{localStorage.setItem('oc.prefs',JSON.stringify(S.prefs));document.body.style.fontSize=S.prefs.font+'px';$('#hint').textContent=S.prefs.enterSend?'Enter to send · Shift+Enter for newline · Esc to stop':'Ctrl/Cmd+Enter to send · Esc to stop'};
const fmt=n=>n>1e6?(n/1e6).toFixed(1)+' MB':Math.max(1,Math.round(n/1e3))+' KB';
const stop=async()=>{if(S.busy){S.busy.abort();while(S.busy)await new Promise(r=>setTimeout(r,20))}};
const save=async c=>{c=c||S.cur;if(c&&c.msgs.length){c.updated=Date.now();await put('convs',c)}};
const newConv=model=>({id:uid(),title:'New chat',model,msgs:[],boundary:0,pinned:false,archived:false,created:Date.now(),updated:Date.now()});
const download=(name,text,type='application/json')=>{const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1e3)};
const dlg=$('#dlg'),show=h=>{dlg.innerHTML=h;if(!dlg.open)dlg.showModal()},close=()=>dlg.close();
dlg.addEventListener('click',e=>{if(e.target.dataset.close!==undefined)close()});
const side=o=>{$('#side').classList.toggle('open',!!o);$('#scrim').classList.toggle('on',!!o)};
async function loadModels(){S.models=(await getAll('models')).sort((a,b)=>a.created-b.created);const s=$('#msel'),want=S.cur?.model||S.prefs.model||s.value;
 s.innerHTML=S.models.length?S.models.map(m=>`<option value="${esc(m.id)}" title="${esc(m.descr||'')}">${esc(m.name)}</option>`).join(''):'<option value="">No models</option>';if(S.models.some(m=>m.id===want))s.value=want}
async function loadConvs(){const q=$('#q').value.toLowerCase();S.convs=(await getAll('convs')).filter(c=>!c.archived&&(!q||c.title.toLowerCase().includes(q)||c.msgs.some(m=>m.content.toLowerCase().includes(q)))).sort((a,b)=>(+!!b.pinned-+!!a.pinned)||b.updated-a.updated);
 const h=$('#hist');h.innerHTML='';const d0=new Date().setHours(0,0,0,0),g=c=>c.pinned?'Pinned':c.updated>=d0?'Today':c.updated>=d0-864e5?'Yesterday':c.updated>=d0-6048e5?'Previous 7 days':'Older';let last='';
 if(!S.convs.length)h.innerHTML='<p class="warn" style="padding:8px">No conversations yet.</p>';
 for(const c of S.convs){const k=g(c);if(k!==last){h.insertAdjacentHTML('beforeend',`<div class="grp">${k}</div>`);last=k}
  const d=document.createElement('div');d.className='ci'+(S.cur?.id===c.id?' on':'');d.innerHTML=`<button class="t">${esc(c.title)}</button><button class="ib" aria-label="Conversation actions" title="Actions">${ic('dots')}</button>`;
  d.firstChild.onclick=()=>open(c.id);d.lastChild.onclick=e=>{e.stopPropagation();cmenu(c,e.currentTarget)};h.appendChild(d)}}
function cmenu(c,el){const m=$('#menu'),r=el.getBoundingClientRect();m.innerHTML=`<button data-a="r">Rename</button><button data-a="p">${c.pinned?'Unpin':'Pin'}</button><button data-a="a">Archive</button><button data-a="x" style="color:var(--err)">Delete…</button>`;
 m.style.display='block';m.style.top=Math.min(r.bottom,innerHeight-190)+'px';m.style.left=Math.min(r.left,innerWidth-170)+'px';
 m.onclick=async e=>{const a=e.target.dataset.a;if(!a)return;m.style.display='none';
  if(a==='x')return delDlg(c);if(a==='r'){const t=prompt('Rename conversation',c.title);if(!t?.trim())return;c.title=t.trim().slice(0,120)}
  if(a==='p')c.pinned=!c.pinned;if(a==='a'){c.archived=true;if(S.cur?.id===c.id)S.cur=null}
  await put('convs',c);await loadConvs();render()}}
async function open(id){await stop();if(S.cur)S.drafts[S.cur.id]=$('#in').value;S.cur=await get('convs',id);S.err='';$('#in').value=S.drafts[id]||'';side(0);if(S.models.some(m=>m.id===S.cur.model))$('#msel').value=S.cur.model;S.follow=true;render();loadConvs()}
function delDlg(c){show(`<h3>Delete conversation?</h3><p class="warn">“${esc(c.title)}” and its messages will be permanently removed from this browser.</p><div class="row"><button class="btn" data-close>Cancel</button><button class="btn d" id="ok">Delete</button></div>`);
 $('#ok').onclick=async()=>{await del('convs',c.id);if(S.cur?.id===c.id)S.cur=null;close();await loadConvs();render()}}
function ctxDlg(){if(!S.cur?.msgs.length)return toast('Nothing to clear yet');
 show(`<h3>Clear context</h3><p class="warn">Choose what happens. These are all different from each other.</p>
 <div class="mi"><div>Clear model context<small>Transcript stays visible; the model stops receiving earlier messages.</small></div><button class="btn" id="c1">Clear</button></div>
 <div class="mi"><div>Start fresh<small>Opens a new empty chat; this one stays in history.</small></div><button class="btn" id="c2">New chat</button></div>
 <div class="mi"><div>Delete conversation<small>Permanently removes it.</small></div><button class="btn d" id="c3">Delete…</button></div><div class="row"><button class="btn" data-close>Close</button></div>`);
 $('#c1').onclick=async()=>{await stop();const c=S.cur;c.msgs.push({role:'notice',content:'Context cleared. Earlier messages are no longer sent to the model.',t:Date.now()});c.boundary=c.msgs.length;await save(c);close();render()};
 $('#c2').onclick=async()=>{await stop();S.cur=null;close();render();loadConvs()};$('#c3').onclick=()=>delDlg(S.cur)}
// ---- models ----
function modelsDlg(){show(`<h3>Models</h3>${S.models.map(m=>`<div class="mi"><div>${esc(m.name)}<small>${esc(m.model)} · ${esc(m.base)}</small></div><button class="btn" data-u="${m.id}">Duplicate</button> <button class="btn" data-e="${m.id}">Edit</button></div>`).join('')||'<p class="warn">No models yet. Add any OpenAI-compatible endpoint (llama.cpp, Ollama, vLLM, LM Studio, hosted APIs). The browser talks to it directly, so the server must allow CORS.</p>'}<div class="row"><button class="btn" data-close>Close</button><button class="btn p" id="add">Add model</button></div>`);
 $('#add').onclick=()=>modelForm();dlg.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>modelForm(S.models.find(m=>m.id===b.dataset.e)));
 dlg.querySelectorAll('[data-u]').forEach(b=>b.onclick=async()=>{const m=S.models.find(x=>x.id===b.dataset.u);await put('models',{...m,id:uid(),name:m.name+' copy',created:Date.now()});await loadModels();modelsDlg()})}
async function testConn(base,key){const t=performance.now(),ms=()=>Math.round(performance.now()-t);
 try{const r=await fetch(base+'/models',{headers:key?{authorization:'Bearer '+key}:{},cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(r.ok){const j=await r.json().catch(()=>({}));return{ok:1,models:(j.data||[]).map(x=>x.id),note:`Reachable in ${ms()} ms. Browser (CORS) access works.`}}
  return{models:[],note:(r.status===404?'Server reachable and CORS works, but /models is unavailable; enter the model ID manually.':explainError({status:r.status},{base})+' (Server answered, so CORS is fine.)')}}
 catch(e){return{models:[],note:explainError(e,{base})}}}
function modelForm(m){const n=!m;m=m||{name:'',model:'',base:'',key:'',descr:'',sys:'',temp:.7,top_p:1,max_tokens:2048,stream:true};
 show(`<h3>${n?'Add':'Edit'} model</h3><form id="mf"><label for="f_name">Display name</label><input id="f_name" value="${esc(m.name)}" required>
 <label for="f_base">API base URL (usually ends in /v1)</label><input id="f_base" value="${esc(m.base)}" placeholder="https://your-server/v1" required><label for="f_key">API key (optional)</label><input id="f_key" type="password" autocomplete="off" value="${esc(m.key||'')}">
 <p class="warn">Keys are stored unencrypted in this browser profile. Anyone with access to the profile or device can read them. Use a restricted key.</p>
 <div class="row" style="justify-content:flex-start"><button type="button" class="btn" id="test">Test connection &amp; fetch model IDs</button></div><p class="warn pre" id="diag"></p>
 <label for="f_model">Backend model ID (sent to the API)</label><input id="f_model" list="ids" value="${esc(m.model)}" required><datalist id="ids"></datalist>
 <label for="f_descr">Description</label><input id="f_descr" value="${esc(m.descr||'')}"><label for="f_sys">System prompt</label><textarea id="f_sys" rows="3">${esc(m.sys||'')}</textarea>
 <div class="g2"><div><label for="f_temp">Temperature</label><input id="f_temp" type="number" step=".05" min="0" max="2" value="${m.temp}"></div><div><label for="f_top_p">Top-p</label><input id="f_top_p" type="number" step=".05" min="0" max="1" value="${m.top_p}"></div>
 <div><label for="f_max_tokens">Max output tokens</label><input id="f_max_tokens" type="number" min="1" value="${m.max_tokens}"></div><div><label for="f_stream">Streaming</label><select id="f_stream"><option value="1">On</option><option value="0" ${m.stream?'':'selected'}>Off</option></select></div></div>
 <p class="warn">Real output length also depends on the backend's context window and server configuration.</p><p class="err" id="fe"></p>
 <div class="row">${n?'':'<button type="button" class="btn d" id="rm">Delete</button>'}<button type="button" class="btn" id="back">Back</button><button class="btn p">Save</button></div></form>`);
 $('#back').onclick=modelsDlg;const base=()=>$('#f_base').value.trim().replace(/\/+$/,'');
 $('#test').onclick=async()=>{$('#diag').textContent='Testing…';const r=await testConn(base(),$('#f_key').value);$('#diag').textContent=r.note+(r.models.length?`\n${r.models.length} model IDs found; pick one in the model ID field.`:'');$('#ids').innerHTML=r.models.map(i=>`<option value="${esc(i)}">`).join('')};
 $('#mf').onsubmit=async e=>{e.preventDefault();if(!/^https?:\/\//.test(base()))return $('#fe').textContent='Base URL must start with http:// or https://';
  const v=k=>$('#f_'+k).value;await put('models',{...m,id:m.id||uid(),created:m.created||Date.now(),name:v('name').trim(),base:base(),key:v('key'),model:v('model').trim(),descr:v('descr'),sys:v('sys'),temp:+v('temp'),top_p:+v('top_p'),max_tokens:Math.max(1,+v('max_tokens')||2048),stream:v('stream')==='1'});
  await loadModels();if(!S.prefs.model){S.prefs.model=$('#msel').value;savePrefs()}modelsDlg();render()};
 if(!n)$('#rm').onclick=async()=>{const k=(await getAll('convs')).filter(c=>c.model===m.id).length;if(!confirm(k?`${k} conversation(s) use this model. They are kept (messages keep their model name); only the profile is removed. Delete it?`:'Delete this model profile?'))return;await del('models',m.id);await loadModels();modelsDlg()}}
// ---- settings / backup ----
let installEv;addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEv=e});
async function settingsDlg(){const est=await navigator.storage?.estimate?.().catch(()=>0),pers=await navigator.storage?.persisted?.().catch(()=>0),cs=await getAll('convs');
 show(`<h3>Settings</h3><h4>Appearance &amp; input</h4><label for="s_font">Font size</label><select id="s_font">${[14,15,17].map(f=>`<option ${S.prefs.font===f?'selected':''}>${f}</option>`).join('')}</select>
 <label class="chk" style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="s_enter" ${S.prefs.enterSend?'checked':''}> Enter sends (otherwise Ctrl/Cmd+Enter)</label>
 <h4>Backup &amp; restore</h4><label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="s_keys"> Include API keys in the backup file (plain text)</label>
 <div class="row" style="justify-content:flex-start"><button class="btn" id="s_exp">Export all data (JSON)</button></div><label for="s_file">Import a backup</label><input type="file" id="s_file" accept="application/json,.json">
 <p class="warn pre">Last export: ${S.prefs.lastBackup?new Date(S.prefs.lastBackup).toLocaleString():'never'}</p>
 <h4>Local storage</h4><p class="warn pre">${S.models.length} model profiles · ${cs.length} conversations · ${cs.reduce((n,c)=>n+c.msgs.length,0)} messages\nBrowser storage: ${est?fmt(est.usage)+' used of about '+fmt(est.quota):'unavailable'} · Persistent: ${pers?'yes':'no (the browser may evict data under storage pressure)'}</p>
 <div class="row" style="justify-content:flex-start">${navigator.storage?.persist?'<button class="btn" id="s_per">Request persistent storage</button>':''}${installEv?'<button class="btn" id="s_inst">Install app</button>':''}</div>
 <h4>Privacy &amp; offline</h4><p class="warn">Everything is stored only in this browser (IndexedDB). Chats go straight from your browser to the model endpoints you configure; there is no OpenClose server. API keys are not protected from anyone with access to this browser profile. Offline, the interface and your saved chats open, but replies need a reachable model endpoint. Model responses and keys are never cached.</p>
 <div class="row"><button class="btn d" id="s_clr">Clear all local data…</button><button class="btn" data-close>Close</button></div>`);
 $('#s_font').onchange=e=>{S.prefs.font=+e.target.value;savePrefs()};$('#s_enter').onchange=e=>{S.prefs.enterSend=e.target.checked;savePrefs()};
 $('#s_exp').onclick=async()=>{const b=await exportAll($('#s_keys').checked);download(`openclose-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(b,null,1));S.prefs.lastBackup=Date.now();savePrefs();toast('Backup downloaded');settingsDlg()};
 $('#s_per')&&($('#s_per').onclick=async()=>{toast(await navigator.storage.persist()?'Persistent storage granted':'Browser declined persistence');settingsDlg()});$('#s_inst')&&($('#s_inst').onclick=()=>installEv.prompt());
 $('#s_clr').onclick=async()=>{if(prompt('This permanently deletes all chats, model profiles and settings in this browser. Export a backup first. Type DELETE to confirm.')!=='DELETE')return;
  await stop();await clearAll();localStorage.removeItem('oc.prefs');S.cur=null;S.prefs={enterSend:true,font:15};savePrefs();await loadModels();await loadConvs();render();close();toast('All local data cleared')};
 $('#s_file').onchange=async e=>{const f=e.target.files[0];if(!f)return;let d,v;try{d=JSON.parse(await f.text());v=validateBackup(d)}catch{v={ok:false,errors:['File is not valid JSON']}}
  if(!v.ok)return show(`<h3>Import failed</h3><p class="err">This file can't be imported. Nothing was changed.</p><p class="warn pre">${v.errors.map(esc).join('\n')}</p><div class="row"><button class="btn" id="bk">Back</button></div>`),$('#bk').onclick=settingsDlg;
  show(`<h3>Import backup</h3><p class="warn pre">Valid backup from ${esc(d.exported||'unknown date')}\n${v.counts.models} models · ${v.counts.convs} conversations · ${v.counts.msgs} messages\nAPI keys included: ${d.includesKeys?'yes':'no'}</p>
  <label for="im">Mode</label><select id="im"><option value="merge">Merge: add new items, keep existing ones that are as new or newer</option><option value="replace">Replace: delete current data first</option></select>
  <div class="row"><button class="btn" id="bk">Cancel</button><button class="btn p" id="go">Import</button></div>`);$('#bk').onclick=settingsDlg;
  $('#go').onclick=async()=>{const mode=$('#im').value;if(mode==='replace'&&!confirm('Replace will delete ALL current local chats and model profiles. Continue?'))return;
   try{await stop();const r=await importBackup(d,mode);S.cur=null;await loadModels();await loadConvs();render();close();toast(`Imported: ${r.added} added, ${r.updated} updated, ${r.skipped} kept`)}catch(x){toast(x.message)}}}}
// ---- rendering ----
function msgEl(m,i,last){const d=document.createElement('div');if(m.role==='notice'){d.className='note';d.textContent=m.content;return d}
 const a=m.role==='assistant';d.className='msg '+m.role;
 d.innerHTML=`<div class="who">${a?esc(m.model||'Assistant'):'You'}</div><div class="body"></div><div class="warn"></div><div class="tools"><button class="ib" data-a="c" aria-label="Copy message" title="Copy">${ic('copy')}</button>${a?(last?`<button class="ib" data-a="r" aria-label="Regenerate" title="Regenerate">${ic('redo')}</button>`:''):`<button class="ib" data-a="e" aria-label="Edit and resend" title="Edit and resend">${ic('edit')}</button>`}</div>`;
 const b=d.querySelector('.body');a?md(b,m.content,true):b.textContent=m.content;
 d.querySelector('.warn').textContent=[m.finish==='length'?'Stopped: reached the max output token limit. Raise it in the model profile.':'',m.finish==='interrupted'?'Generation stopped before completion.':'',m.error||'',m.warn||''].filter(Boolean).join(' ');
 d.querySelector('.tools').onclick=async e=>{const x=e.target.closest('[data-a]')?.dataset.a;if(x==='c'){await navigator.clipboard.writeText(m.content);toast('Copied')}if(x==='r')go(true);
  if(x==='e'&&!S.busy){S.cur.msgs.length=i;S.cur.boundary=Math.min(S.cur.boundary||0,i);$('#in').value=m.content;await save();render();loadConvs();$('#in').focus();toast('Edit the message and send. Later messages were removed.')}};return d}
function render(){const box=$('#msgs');box.innerHTML='';$('#title').textContent=S.cur?.title||'New chat';const ms=S.cur?.msgs||[];
 if(!ms.length){const n=S.models.find(x=>x.id===$('#msel').value)?.name;box.innerHTML=`<div class="empty"><h2>${n?'Talk to '+esc(n):'Add a model to begin'}</h2><div class="sug">${S.models.length?['Explain how SSE streaming works','Write a Python function to merge intervals','Derive the quadratic formula in LaTeX'].map(t=>`<button>${esc(t)}</button>`).join(''):'<button id="am">Add your first model</button>'}</div></div>`;
  box.querySelectorAll('.sug button').forEach(b=>b.onclick=()=>{if(b.id==='am')return modelsDlg();$('#in').value=b.textContent;$('#in').focus()})}
 ms.forEach((m,i)=>box.appendChild(msgEl(m,i,i===ms.length-1)));
 if(S.err)box.insertAdjacentHTML('beforeend',`<p class="err" role="alert">${esc(S.err)}</p>`);
 $('#send').innerHTML=ic(S.busy?'stop':'send');$('#send').setAttribute('aria-label',S.busy?'Stop generation':'Send');if(S.follow)$('#thread').scrollTop=1e9}
// ---- send / stream ----
async function go(regen){if(S.busy)return;const inp=$('#in'),text=inp.value.trim();if(!regen&&!text)return;
 const m=S.models.find(x=>x.id===$('#msel').value);if(!m){toast('Add a model first');return modelsDlg()}
 if(!S.cur)S.cur=newConv(m.id);const c=S.cur,ms=c.msgs;S.err='';
 if(regen){if(ms.at(-1)?.role==='assistant')ms.pop()}else{ms.push({role:'user',content:text,t:Date.now()});inp.value='';inp.style.height='auto';if(c.title==='New chat')c.title=text.replace(/\s+/g,' ').slice(0,48)}
 c.model=m.id;await save(c);const a={role:'assistant',content:'',model:m.name,modelId:m.id,t:Date.now()};ms.push(a);
 S.follow=true;const ac=new AbortController();S.busy=ac;render();loadConvs();
 const el=$('#msgs').lastChild.querySelector('.body');let raf=0;const paint=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;md(el,a.content,false);if(S.follow)$('#thread').scrollTop=1e9})};const t0=performance.now();
 try{const r=await fetch(m.base+'/chat/completions',{method:'POST',headers:{'content-type':'application/json',...(m.key?{authorization:'Bearer '+m.key}:{})},cache:'no-store',signal:ac.signal,
   body:JSON.stringify({model:m.model,messages:buildMessages({msgs:ms.slice(0,-1),boundary:c.boundary},m),temperature:m.temp,top_p:m.top_p,max_tokens:m.max_tokens,stream:!!m.stream})});
  if(!r.ok)throw{status:r.status,text:(await r.text().catch(()=>'')).slice(0,300)};
  if(!m.stream){const j=await r.json();a.content=j.choices?.[0]?.message?.content||'';a.finish=j.choices?.[0]?.finish_reason;a.usage=j.usage}
  else{const p=new SSEParser(ev=>{if(ev.error)a.error=ev.error;if(ev.delta){a.content+=ev.delta;paint()}if(ev.finish)a.finish=ev.finish;if(ev.usage)a.usage=ev.usage;if(ev.malformed)a.warn='Some malformed stream events were skipped.'});
   const rd=r.body.getReader(),td=new TextDecoder();for(;;){const{done,value}=await rd.read();if(done)break;p.push(td.decode(value,{stream:true}))}p.end()}
  a.ms=Math.round(performance.now()-t0)}
 catch(e){if(e.name==='AbortError')a.finish='interrupted';else{a.error=explainError(e,{base:m.base});if(a.content)a.finish='interrupted'}}
 S.busy=null;if(!a.content){ms.splice(ms.indexOf(a),1);if(a.error&&S.cur===c)S.err=a.error}
 await save(c);if(S.cur===c)render();loadConvs()}
async function boot(){if(!(window.marked&&window.DOMPurify&&window.hljs&&window.renderMathInElement))throw new Error('LIBS');await init();
 $('#newc').innerHTML=ic('plus')+' New chat';$('#mm').innerHTML=ic('cpu')+' Models';$('#set').innerHTML=ic('gear')+' Settings';$('#closeSide').innerHTML=ic('x');$('#openSide').innerHTML=ic('menu');$('#ctxb').innerHTML=ic('eraser');$('#exp').innerHTML=ic('file');$('#jump').innerHTML=ic('down');
 $('#newc').onclick=async()=>{await stop();S.cur=null;S.err='';side(0);render();$('#in').focus()};$('#mm').onclick=()=>{side(0);modelsDlg()};$('#set').onclick=()=>{side(0);settingsDlg()};
 $('#openSide').onclick=()=>side(1);$('#closeSide').onclick=$('#scrim').onclick=()=>side(0);$('#q').oninput=loadConvs;$('#ctxb').onclick=ctxDlg;
 $('#exp').onclick=()=>{const c=S.cur;if(c?.msgs.length)download(`${c.title.replace(/[^\w-]+/g,'_')||'chat'}.md`,`# ${c.title}\n\n`+c.msgs.map(m=>`**${m.role==='assistant'?m.model:m.role}**\n\n${m.content}`).join('\n\n---\n\n'),'text/markdown')};
 $('#msel').onchange=async()=>{S.prefs.model=$('#msel').value;savePrefs();if(S.cur){S.cur.model=$('#msel').value;await save();if(S.cur.msgs.some(x=>x.model))toast('Model switched. Earlier context is reinterpreted by the new model.')}render()};
 const t=$('#thread');t.onscroll=()=>{S.follow=t.scrollHeight-t.scrollTop-t.clientHeight<80;$('#jump').style.display=S.follow?'none':'grid'};$('#jump').onclick=()=>t.scrollTo({top:t.scrollHeight,behavior:'smooth'});
 const i=$('#in');i.oninput=()=>{i.style.height='auto';i.style.height=Math.min(i.scrollHeight,200)+'px'};
 i.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&(S.prefs.enterSend?!e.shiftKey:(e.ctrlKey||e.metaKey))){e.preventDefault();go()}};
 document.onkeydown=e=>{if(e.key==='Escape'&&S.busy)S.busy.abort()};$('#send').onclick=()=>S.busy?S.busy.abort():go();document.onclick=e=>{const mn=$('#menu');if(mn&&!e.target.closest('#menu,.ci .ib'))mn.style.display='none'};
 DOMPurify.addHook('afterSanitizeAttributes',n=>{if(n.tagName==='A'){n.setAttribute('target','_blank');n.setAttribute('rel','noopener noreferrer nofollow')}});
 savePrefs();await loadModels();await loadConvs();render();if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{})}
boot().catch(e=>{document.body.innerHTML=e.message==='LIBS'?'<div style="padding:24px;max-width:560px;font-family:system-ui;line-height:1.6"><h2>OpenClose files are missing</h2><p>The scripts in <code>vendor/</code> failed to load (404). Deploy or serve the <b>entire</b> <code>public/</code> folder, not just index.html and app.js. If you use a single-page-app fallback, make sure real files are served first.</p></div>':'<p style="padding:20px">OpenClose could not open its local database ('+esc(e.message||e)+'). Private browsing may block IndexedDB.</p>'});
