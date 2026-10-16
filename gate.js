/* ETIB: вход и расшифровка. Страницы лежат на сайте только в зашифрованном виде (e-*.enc).
   Логин+пароль -> ключ AES (PBKDF2). Ключ запоминается на устройстве, повторно вводить пароль не нужно. */
(function(){
'use strict';
var D=document,H=D.documentElement,PAGE=H.getAttribute('data-page')||'index';
var te=new TextEncoder(),td=new TextDecoder(),META=null,memKey=null;

if('serviceWorker' in navigator&&location.protocol!=='file:')addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}

function b64(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function idb(){return new Promise(function(ok,no){var r=indexedDB.open('etib-gate',1);r.onupgradeneeded=function(){r.result.createObjectStore('k')};r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}})}
function kget(){return idb().then(function(db){return new Promise(function(ok,no){var q=db.transaction('k').objectStore('k').get('key');q.onsuccess=function(){ok(q.result||null)};q.onerror=function(){no(q.error)}})}).catch(function(){return memKey})}
function kput(v){memKey=v;return idb().then(function(db){return new Promise(function(ok){var t=db.transaction('k','readwrite');t.objectStore('k').put(v,'key');t.oncomplete=ok;t.onerror=ok})}).catch(function(){})}
function kdel(){memKey=null;return idb().then(function(db){return new Promise(function(ok){var t=db.transaction('k','readwrite');t.objectStore('k').delete('key');t.oncomplete=ok;t.onerror=ok})}).catch(function(){})}

function getMeta(){return fetch('e-meta.json').then(function(r){if(!r.ok)throw new Error('net');return r.json()})}
function getEnc(f){return fetch('e-'+f+'.enc').then(function(r){if(!r.ok)throw new Error('net');return r.arrayBuffer()})}
function dec(key,buf){var u=new Uint8Array(buf);return crypto.subtle.decrypt({name:'AES-GCM',iv:u.slice(0,12)},key,u.slice(12))}
function derive(login,pass){
 return crypto.subtle.importKey('raw',te.encode(login.trim().toLowerCase()+':'+pass),'PBKDF2',false,['deriveKey'])
 .then(function(b){return crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(META.salt),iterations:META.iter,hash:'SHA-256'},b,{name:'AES-GCM',length:256},false,['decrypt'])})}
function checkKey(key){return dec(key,b64(META.check)).then(function(p){return td.decode(p)==='ETIB-OK'})}

/* водяной знак: выполняется внутри расшифрованной страницы */
function WM(dev){
 var D=document,el=null;
 function p2(n){return(n<10?'0':'')+n}
 function stamp(){var d=new Date();return p2(d.getDate())+'.'+p2(d.getMonth()+1)+'.'+d.getFullYear()+' '+p2(d.getHours())+':'+p2(d.getMinutes())}
 function paint(){
  var t='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><g transform="rotate(-28 160 100)" font-family="Arial,Helvetica,sans-serif" font-weight="700" fill="#808080" fill-opacity=".30" text-anchor="middle"><text x="160" y="92" font-size="15">ETIB PARFUM · ДЛЯ СОТРУДНИКОВ</text><text x="160" y="114" font-size="13">'+dev+' · '+stamp()+'</text></g></svg>';
  el.style.backgroundImage='url("data:image/svg+xml;charset=utf-8,'+encodeURIComponent(t)+'")'}
 function mount(){
  if(el&&el.isConnected)return;
  el=D.createElement('div');el.setAttribute('aria-hidden','true');
  el.style.cssText='position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;pointer-events:none;-webkit-user-select:none;user-select:none;background-repeat:repeat';
  paint();(D.body||D.documentElement).appendChild(el)}
 mount();setInterval(function(){mount();paint()},15000);
 try{new MutationObserver(function(){if(!el.isConnected)mount()}).observe(D.documentElement,{childList:true});if(D.body)new MutationObserver(function(){if(!el.isConnected)mount()}).observe(D.body,{childList:true})}catch(e){}
}
function devId(){try{var v=localStorage.getItem('etib-dev');if(!v){v='';var c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',r=crypto.getRandomValues(new Uint8Array(4));for(var i=0;i<4;i++)v+=c[r[i]%c.length];localStorage.setItem('etib-dev',v)}return v}catch(e){return'----'}}

function render(key){
 var pg=META.pages[PAGE];if(!pg)throw new Error('page');
 return Promise.all([getEnc(pg.file).then(function(b){return dec(key,b)})].concat(pg.assets.map(function(a){
  return getEnc(a.name).then(function(b){return dec(key,b)}).then(function(p){return[a.name,URL.createObjectURL(new Blob([p],{type:a.type}))]})})))
 .then(function(r){
  var html=td.decode(r[0]),urls={};for(var i=1;i<r.length;i++)urls[r[i][0]]=r[i][1];
  html=html.replace(/(\s(?:src|href)=)(["'])([^"']+)\2/g,function(m,a,q,v){return urls[v]?a+q+urls[v]+q:m});
  var inj='<script>('+WM.toString()+')('+JSON.stringify(devId())+')<\/script>',i2=html.lastIndexOf('</body>');
  html=i2<0?html+inj:html.slice(0,i2)+inj+html.slice(i2);
  D.open();D.write(html);D.close()})}

/* экран входа */
var CSS='html,body{margin:0;height:100%}body{background:#f7f2f1;color:#1a1215;font:15px/1.5 Manrope,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:env(safe-area-inset-top,0) 16px env(safe-area-inset-bottom,0)}'+
 '@media(prefers-color-scheme:dark){body{background:#0f0a0d;color:#f3eee6}.g-in{background:#171015!important;border-color:#33252b!important;color:#f3eee6!important}.g-mu{color:#b3a6a8!important}.g-bt{background:#e3a2b1!important;color:#0f0a0d!important}.g-mk{border-color:#f3eee6!important}}'+
 '.g{width:100%;max-width:340px}.g-mk{width:56px;height:56px;border:2px solid #1a1215;border-radius:50%;display:grid;place-items:center;font:700 29px/1 "Playfair Display",Georgia,serif;margin:0 auto 14px}'+
 '.g h1{margin:0;text-align:center;font:700 22px/1.1 "Playfair Display",Georgia,serif;letter-spacing:.14em}.g-mu{margin:8px 0 22px;text-align:center;color:#6b5f62;font-size:14px}'+
 '.g-in{display:block;width:100%;box-sizing:border-box;margin:0 0 10px;padding:14px 16px;font:inherit;font-size:16px;border:1.5px solid #e0d3d2;border-radius:14px;background:#fffdfc;color:#1a1215}.g-in:focus{outline:3px solid #7a2e3f;outline-offset:1px}'+
 '.g-bt{display:block;width:100%;margin-top:4px;padding:14px;font:700 15px inherit;font-family:inherit;border:0;border-radius:999px;background:#7a2e3f;color:#fff;cursor:pointer}.g-bt:disabled{opacity:.6}'+
 '.g-er{min-height:20px;margin:10px 0 0;text-align:center;color:#b3261e;font-size:13.5px}';
function login(msg){
 H.lang='ru';D.title='ETIB PARFUM — вход';
 D.head.insertAdjacentHTML('beforeend','<style>'+CSS+'</style>');
 D.body.innerHTML='<form class="g" id="gf" autocomplete="on"><div class="g-mk">E</div><h1>ETIB PARFUM</h1><p class="g-mu">Вход для сотрудников</p>'+
  '<input class="g-in" name="username" id="gu" type="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Логин" required>'+
  '<input class="g-in" name="password" id="gp" type="password" autocomplete="current-password" placeholder="Пароль" required>'+
  '<button class="g-bt" id="gb" type="submit">Войти</button><p class="g-er" id="ge" role="alert"></p></form>';
 var f=D.getElementById('gf'),er=D.getElementById('ge'),bt=D.getElementById('gb');er.textContent=msg||'';
 f.addEventListener('submit',function(e){e.preventDefault();er.textContent='';bt.disabled=true;bt.textContent='Проверяем…';
  derive(D.getElementById('gu').value,D.getElementById('gp').value).then(function(k){return checkKey(k).then(function(ok){if(!ok)throw 0;return k})})
  .then(function(k){return kput({key:k,v:META.v}).then(function(){return render(k)})})
  .catch(function(){bt.disabled=false;bt.textContent='Войти';er.textContent='Неверный логин или пароль';D.getElementById('gp').value=''})})}

function start(){
 if(!(window.crypto&&crypto.subtle)){D.body.textContent='Нужен защищённый адрес (https).';return}
 getMeta().then(function(m){META=m;
  if(/[?&]logout\b/.test(location.search))return kdel().then(function(){login()});
  return kget().then(function(s){
   if(!s||s.v!==META.v)return login();
   return checkKey(s.key).then(function(ok){if(!ok)throw 0;return render(s.key)})
    .catch(function(e){ if(e&&e.message==='net'||e instanceof TypeError){D.body.textContent='Нет сети, а копии страницы на телефоне пока нет.';return}
     return kdel().then(function(){login('Доступ обновлён. Войдите снова.')})})})})
 .catch(function(){D.body.textContent='Не удалось загрузить. Проверьте интернет.'})}
if(D.body)start();else D.addEventListener('DOMContentLoaded',start);
})();
