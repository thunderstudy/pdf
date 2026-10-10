/* ThunderStudy PDF service worker: offline app shell + offline copies of PDFs you opened from links. */
const VERSION='v1';
const SHELL=`ts-shell-${VERSION}`,FILES='ts-pdf-files-v1',MAX_FILES=8;
const PRECACHE=['/','/index.html','/pdf.html','/reader.html','/styles.css','/home.css','/site.webmanifest','/favicon.svg?v=2','/icons/icon-192.png','/icons/icon-512.png',
'/js/home.js','/js/dearflip-reader.js','/js/pdf-link.js','/js/recent.js','/js/reader-search.js','/js/pwa.js',
'/dflip/css/dflip.min.css','/dflip/css/themify-icons.min.css','/dflip/fonts/themify.woff','/dflip/fonts/themify.ttf',
'/dflip/js/dflip.min.js','/dflip/js/libs/jquery.min.js','/dflip/js/libs/pdf.min.js','/dflip/js/libs/pdf.worker.min.js','/dflip/js/libs/three.min.js','/dflip/js/libs/mockup.min.js','/dflip/js/libs/compatibility.js',
'/dflip/sound/turn.mp3','/dflip/images/loading.gif','/dflip/images/textures/white.jpg','/assets/sample.pdf'];
const PAGE_ALIAS={'/':'/index.html','/pdf':'/pdf.html','/pdf/':'/pdf.html','/reader':'/reader.html','/reader/':'/reader.html'};

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{const c=await caches.open(SHELL);await Promise.all(PRECACHE.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})));await self.skipWaiting()})());
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{for(const k of await caches.keys()){if(k.startsWith('ts-shell-')&&k!==SHELL)await caches.delete(k)}await self.clients.claim()})());
});
self.addEventListener('message',e=>{if(e.data==='skip-waiting')self.skipWaiting()});

async function trimFiles(){const c=await caches.open(FILES),keys=await c.keys();for(let i=0;i<keys.length-MAX_FILES;i++)await c.delete(keys[i])}
const offlineJson=()=>new Response(JSON.stringify({code:'offline',message:'You are offline and this PDF is not saved on this device yet.'}),{status:503,headers:{'Content-Type':'application/json; charset=utf-8','X-Pdf-Error':'offline'}});

async function pdfProxy(req){
  const cache=await caches.open(FILES);
  try{
    const res=await fetch(req);
    if(res.ok&&(res.headers.get('content-type')||'').includes('application/pdf')){await cache.put(req.url,res.clone());trimFiles()}
    return res;
  }catch{
    const hit=await cache.match(req.url);
    return hit||offlineJson();
  }
}
async function networkFirst(req,fallbackKey){
  const cache=await caches.open(SHELL);
  try{const res=await fetch(req);if(res.ok&&res.type==='basic')cache.put(fallbackKey||req,res.clone());return res}
  catch{return (await cache.match(fallbackKey||req,{ignoreSearch:true}))||(await cache.match(req,{ignoreSearch:true}))||Response.error()}
}
async function cacheFirst(req){
  const cache=await caches.open(SHELL),hit=await cache.match(req,{ignoreSearch:true});
  if(hit)return hit;
  const res=await fetch(req);if(res.ok&&res.type==='basic')cache.put(req,res.clone());return res;
}
async function staleWhileRevalidate(req){
  const cache=await caches.open(SHELL),hit=await cache.match(req);
  const net=fetch(req).then(res=>{if(res.ok||res.type==='opaque')cache.put(req,res.clone());return res}).catch(()=>null);
  return hit||(await net)||Response.error();
}

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin){
    if(/^(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname))e.respondWith(staleWhileRevalidate(req));
    return;
  }
  if(url.pathname==='/api/pdf'){e.respondWith(pdfProxy(req));return}
  if(url.pathname==='/sw.js')return;
  if(req.mode==='navigate'){
    const alias=PAGE_ALIAS[url.pathname];
    e.respondWith(networkFirst(req,alias?new Request(alias):undefined));return;
  }
  if(/^\/(dflip|assets|icons)\//.test(url.pathname)){e.respondWith(cacheFirst(req));return}
  e.respondWith(networkFirst(req));
});
