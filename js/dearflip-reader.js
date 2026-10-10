import{normalizePdfUrl,isFolderLink,providerOf,PROVIDER_NAMES,titleFromUrl}from'./pdf-link.js';
import{addRecent}from'./recent.js';
import{initSearch}from'./reader-search.js';
const DEFAULT_PDF='/assets/sample.pdf',MAX_BYTES=60*1024*1024;
const params=new URLSearchParams(location.search);
const book=document.querySelector('#book_pdf'),loading=document.querySelector('#reader-loading'),themeButton=document.querySelector('#reader-theme'),shareButton=document.querySelector('#reader-share'),toast=document.querySelector('#reader-toast');
let source=params.get('link')||(params.get('source')==='upload'?'indexeddb':sessionStorage.getItem('ts-pdf-source'))||DEFAULT_PDF;
let title=params.get('title')||sessionStorage.getItem('ts-pdf-title')||'ThunderStudy PDF';
const startPage=Math.max(1,parseInt(params.get('page'),10)||1);
const originalLink=source;
const isSample=source===DEFAULT_PDF;
document.querySelector('#reader-title').textContent=title;
window.lucide?.createIcons();

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
function setTitle(t){title=t;$('#reader-title').textContent=t;document.title=`${t} · ThunderStudy PDF`}
function showToast(msg){if(!toast)return;toast.textContent=msg;toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove('show'),2200)}
function getStoredFile(){return new Promise((resolve,reject)=>{const request=indexedDB.open('thunderstudy-reader',1);request.onupgradeneeded=()=>request.result.createObjectStore('documents');request.onsuccess=()=>{const tx=request.result.transaction('documents','readonly');const get=tx.objectStore('documents').get('active');get.onsuccess=()=>resolve(get.result||null);get.onerror=()=>reject(get.error)};request.onerror=()=>reject(request.error)})}
function currentPage(){const v=parseInt(document.querySelector('#df_book_page_number')?.value,10);return Number.isFinite(v)&&v>0?v:startPage}

/* ---------- friendly errors ---------- */
class ReaderError extends Error{constructor(code,detail){super(code);this.code=code;this.detail=detail}}
const ICONS={lock:'<path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="4" y="11" width="16" height="10" rx="2"/>',size:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',block:'<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',wifi:'<path d="M2 8.8a15 15 0 0 1 20 0"/><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20h.01"/><path d="m3 3 18 18"/>',doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9.5 13 5 5m0-5-5 5"/>',folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'};
function describe(err){
  const p=err.provider,name=p?PROVIDER_NAMES[p]:'the host';
  switch(err.code){
    case'not_public':return{icon:'lock',title:p==='drive'?'This Drive file isn\u2019t public':`This ${name} file isn\u2019t public`,text:`${name} would not hand over the file. Sharing has to allow anyone with the link to view it.`,steps:p==='drive'?['Open the file in Google Drive and tap Share.','Under General access choose \u201CAnyone with the link\u201D.','Keep the role as Viewer, copy the link and paste it again.']:p==='dropbox'?['Open the file in Dropbox and tap Share.','Create a link that anyone can view.','Paste that link here again.']:p==='onedrive'?['Open the file in OneDrive and choose Share.','Set it to \u201CAnyone with the link can view\u201D.','Paste the new link here again.']:['Make sure the file is shared publicly.','Copy the share link and paste it again.']};
    case'too_large':return{icon:'size',title:'This file is over 60 MB',text:'Links are limited to 60 MB so the reader stays fast on every device.',steps:['Download the PDF to your device.','Use Upload a PDF on the start page \u2014 uploaded files can be larger.','Or compress the file and paste the link again.']};
    case'blocked':return{icon:'block',title:'The host blocks access',text:`${name} does not allow other sites to read this file, so we cannot open it from a link.`,steps:['Download the PDF to your device.','Open the start page and use Upload a PDF.']};
    case'not_found':return{icon:'doc',title:'File not found',text:'The host says this file does not exist any more. The link may be wrong or the file was removed.',steps:['Check the link for typos.','Open the file in your browser to confirm it still works.']};
    case'not_pdf':return{icon:'doc',title:'That isn\u2019t a PDF file',text:'The link opens a web page or another file type. Paste a link that ends in .pdf or a share link of the PDF itself.'};
    case'invalid_pdf':return{icon:'doc',title:'This file could not be read',text:'It downloaded, but it is not a valid PDF. It may be damaged, password protected or a different file type.'};
    case'folder':return{icon:'folder',title:'That is a folder link',text:'Open the PDF file itself and paste its share link instead of the folder link.'};
    case'offline':return{icon:'wifi',title:'You are offline',text:'This PDF is not saved on this device yet. Reconnect and open it once, then it will be available offline.'};
    case'unreachable':return{icon:'wifi',title:'Could not reach the host',text:`We could not connect to ${name}. It may be down or the link may be wrong.`,steps:['Check your internet connection.','Try again in a moment.']};
    case'bad_url':return{icon:'doc',title:'That link looks invalid',text:'Paste a full link that starts with https://.'};
    default:return{icon:'doc',title:'This PDF could not be opened',text:err.detail||'Something went wrong while loading the file.'};
  }
}
function showError(err){
  const e=err instanceof ReaderError?err:new ReaderError('unknown',err?.message);
  const d=describe(e);
  const steps=d.steps?`<ol>${d.steps.map(s=>`<li>${s}</li>`).join('')}</ol>`:'';
  loading.classList.add('has-error');
  loading.innerHTML=`<div class="error-card" role="alert"><span class="error-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[d.icon]||ICONS.doc}</svg></span><h2>${d.title}</h2><p>${d.text}</p>${steps}<div class="error-actions"><button type="button" class="btn btn-primary btn-sm" id="err-retry">Try again</button><a class="btn btn-soft btn-sm" href="/pdf.html">Open another PDF</a><a class="btn btn-outline btn-sm" href="/reader?link=%2Fassets%2Fsample.pdf&amp;title=The%20Complete%20Static%20GK%20Capsule">Try sample</a></div></div>`;
  document.querySelector('#err-retry')?.addEventListener('click',()=>location.reload());
}

/* ---------- loading with progress ---------- */
function setProgress(pct,text){const bar=$('#reader-bar'),st=$('#reader-status');if(bar)bar.style.width=(pct==null?'35%':pct+'%');if(bar)bar.classList.toggle('indeterminate',pct==null);if(st)st.textContent=text}
async function downloadBlob(url,provider){
  let res;
  try{res=await fetch(url)}catch{const e=new ReaderError(navigator.onLine===false?'offline':'unreachable');e.provider=provider;throw e}
  if(!res.ok){
    let code='unknown',message='';
    try{const j=await res.clone().json();code=j.code||code;message=j.message||''}catch{}
    if(code==='unknown'){code=res.status===404?'not_found':res.status===413?'too_large':res.status===415?'not_pdf':(res.status===403||res.status===401)?'blocked':res.status>=500?'unreachable':'unknown'}
    const err=new ReaderError(code,message);err.provider=provider;throw err;
  }
  const total=Number(res.headers.get('content-length'))||0;
  if(total>MAX_BYTES){const e=new ReaderError('too_large');e.provider=provider;throw e}
  const reader=res.body?.getReader();
  if(!reader){const b=await res.blob();return b}
  const chunks=[];let got=0;
  for(;;){
    let r;try{r=await reader.read()}catch{const e=new ReaderError(navigator.onLine===false?'offline':'unreachable');e.provider=provider;throw e}
    if(r.done)break;
    chunks.push(r.value);got+=r.value.byteLength;
    if(got>MAX_BYTES){reader.cancel();const e=new ReaderError('too_large');e.provider=provider;throw e}
    const mb=(got/1048576).toFixed(1);
    setProgress(total?Math.min(99,Math.round(got/total*100)):null,total?`Downloading\u2026 ${Math.round(got/total*100)}% (${mb} MB)`:`Downloading\u2026 ${mb} MB`);
  }
  return new Blob(chunks,{type:'application/pdf'});
}
async function ensurePdf(blob,provider){
  const head=new Uint8Array(await blob.slice(0,1024).arrayBuffer());
  const txt=String.fromCharCode(...head);
  if(!txt.includes('%PDF')){const e=new ReaderError(/<html|<!doctype/i.test(txt)?'not_pdf':'invalid_pdf');e.provider=provider;throw e}
  return blob;
}
async function resolveSource(){
  if(source==='indexeddb'){
    const stored=await getStoredFile();
    if(!stored?.blob)throw new ReaderError('unknown','No uploaded PDF was found. Open the start page and upload it again.');
    setTitle(stored.title||title);
    setProgress(null,'Opening your PDF\u2026');
    return URL.createObjectURL(await ensurePdf(stored.blob));
  }
  if(isFolderLink(source))throw new ReaderError('folder');
  const provider=providerOf(source);
  const direct=normalizePdfUrl(source);
  let parsed;try{parsed=new URL(direct,location.href)}catch{throw new ReaderError('bad_url')}
  if(!/^https?:$/i.test(parsed.protocol))throw new ReaderError('bad_url');
  if(/fliphtml5\.com|flipbuilder\.com/i.test(parsed.hostname))throw new ReaderError('not_pdf');
  if(!params.get('title')&&!sessionStorage.getItem('ts-pdf-title')&&!isSample)setTitle(titleFromUrl(source));
  const url=parsed.origin===location.origin?parsed.href:`/api/pdf?url=${encodeURIComponent(parsed.href)}`;
  setProgress(null,'Connecting\u2026');
  const blob=await ensurePdf(await downloadBlob(url,provider),provider);
  return URL.createObjectURL(blob);
}

/* ---------- theme ---------- */
function applyTheme(dark){document.body.classList.toggle('reader-light',!dark);localStorage.setItem('ts-reader-theme',dark?'dark':'light');themeButton.innerHTML=`<i data-lucide="${dark?'sun':'moon'}"></i>`;window.lucide?.createIcons()}
applyTheme(localStorage.getItem('ts-reader-theme')!=='light');
themeButton.addEventListener('click',()=>applyTheme(document.body.classList.contains('reader-light')));

/* ---------- share link with page ---------- */
async function copyText(text){try{await navigator.clipboard.writeText(text);return true}catch{const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch{}ta.remove();return ok}}
shareButton?.addEventListener('click',async()=>{
  if(source==='indexeddb'){showToast('Uploaded files stay on this device, only links can be shared');return}
  const q=new URLSearchParams({link:isSample?DEFAULT_PDF:originalLink});
  if(title&&title!=='ThunderStudy PDF')q.set('title',title);
  const page=currentPage();if(page>1)q.set('page',page);
  const url=`${location.origin}/reader?${q}`;
  showToast(await copyText(url)?`Link copied \u00B7 opens on page ${page}`:'Could not copy the link');
});

/* ---------- wheel + keyboard ---------- */
function enableControls(){
  let lock=0;
  book.addEventListener('wheel',e=>{if(book.classList.contains('df-zoom-enabled')||e.ctrlKey||Math.abs(e.deltaY)<8)return;e.preventDefault();const now=Date.now();if(now-lock<650)return;lock=now;const btn=book.querySelector(e.deltaY>0?'.df-ui-next':'.df-ui-prev');if(btn&&btn.style.display!=='none')btn.click()},{passive:false});
  document.addEventListener('keydown',e=>{
    if(e.target.closest?.('input,textarea'))return;
    if(e.key==='g'||e.key==='G'){const i=$('#df_book_page_number');if(i){e.preventDefault();i.focus();i.select()}}
  });
}

/* ---------- start ---------- */
async function start(){
  try{
    const file=await resolveSource();
    if(source!=='indexeddb'&&!isSample)addRecent(originalLink,title);
    setProgress(100,'Opening your book\u2026');
    window.option_book_pdf={source:file,webgl:true,backgroundColor:document.body.classList.contains('reader-light')?'#eee8dc':'#273230',sound:'dflip/sound/turn.mp3',autoPlay:false,enableDownload:true,height:'100%',search:false,openPage:startPage,moreControls:'pageMode,startPage,thumbnail,outline,more'};
    book.setAttribute('source',file);
    const script=document.createElement('script');
    script.src='dflip/js/dflip.min.js';
    script.onload=()=>{loading?.remove();window.lucide?.createIcons();enableControls();initSearch({book,fileUrl:file,toast:showToast})};
    script.onerror=()=>showError(new ReaderError('unknown','The viewer could not be loaded. Check your connection and try again.'));
    document.body.appendChild(script);
  }catch(error){showError(error)}
}
start();
