/* ETIB: работа без сети. Страницы хранятся в зашифрованном виде; при наличии интернета берутся свежие, без сети — копия на телефоне. */
const V='etib-mvbcz8k3';
const FILES=["./","index.html","catalog.html","sales.html","trainer.html","memo.html","gate.js","e-meta.json","e-etib-ui.css.enc","e-etib-ui.js.enc","e-index.html.enc","e-tips.js.enc","e-pron.js.enc","e-catalog.html.enc","e-sales.html.enc","e-trainer-data.js.enc","e-rabbit.js.enc","e-trainer.html.enc","manifest.webmanifest","favicon.svg","icon-192.png","icon-512.png","icon-maskable-512.png","apple-touch-icon.png"];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(V).then(c=>Promise.all(FILES.map(f=>c.add(f).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(caches.open(V).then(c=>{
    const net=fetch(r,{cache:'no-cache'}).then(res=>{if(res&&res.ok)c.put(r,res.clone());return res});
    const wait=new Promise((_,no)=>setTimeout(no,4000));
    return Promise.race([net,wait]).catch(()=>c.match(r,{ignoreSearch:true}).then(hit=>hit||net.catch(()=>Response.error())))}))});
