const V='oc-v1',CORE=['./','index.html','app.js','lib.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','vendor/marked.min.js','vendor/purify.min.js','vendor/highlight.min.js','vendor/github-dark.min.css','vendor/katex/katex.min.js','vendor/katex/katex.min.css','vendor/katex/auto-render.min.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
// Only same-origin GETs are handled. Cross-origin model API calls (and anything with credentials) bypass the cache entirely.
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin||r.headers.has('authorization'))return;
 if(r.mode==='navigate'){e.respondWith(fetch(r).then(x=>{const cp=x.clone();caches.open(V).then(c=>c.put('index.html',cp));return x}).catch(()=>caches.match('index.html')));return}
 e.respondWith(caches.open(V).then(async c=>{const h=await c.match(r);const n=fetch(r).then(x=>{if(x.ok)c.put(r,x.clone());return x}).catch(()=>h);return h||n}))});
