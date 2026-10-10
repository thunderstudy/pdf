/* In-PDF text search (uses the pdf.js bundled with DearFlip). */
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function initSearch({book,fileUrl,toast}){
  const panel=document.querySelector('#find-panel'),input=document.querySelector('#find-input'),meta=document.querySelector('#find-meta'),list=document.querySelector('#find-list'),form=document.querySelector('#find-form');
  if(!panel||!input)return;
  const $j=window.jQuery;
  let doc=null,texts=[],job=0,results=[],cursor=-1,noText=false;

  function goto(page){const el=document.querySelector('#df_book_page_number');if(!el||!$j)return;$j(el).val(page).trigger($j.Event('keyup',{keyCode:13}))}
  function open(){panel.hidden=false;requestAnimationFrame(()=>panel.classList.add('open'));btn?.classList.add('df-active');setTimeout(()=>{input.focus();input.select()},60)}
  function close(){panel.classList.remove('open');btn?.classList.remove('df-active');setTimeout(()=>{panel.hidden=true},180)}
  function toggle(){(!panel.hidden&&panel.classList.contains('open'))?close():open()}

  async function load(){
    if(doc)return doc;
    const lib=window.pdfjsLib;if(!lib)throw new Error('no pdfjs');
    doc=await lib.getDocument({url:fileUrl,cMapUrl:'dflip/js/libs/cmaps/',cMapPacked:true}).promise;
    return doc;
  }
  async function pageText(n){
    if(texts[n]!=null)return texts[n];
    const page=await doc.getPage(n);const tc=await page.getTextContent();
    return texts[n]=tc.items.map(i=>i.str).join(' ').replace(/\s+/g,' ').trim();
  }
  function render(q){
    list.innerHTML=results.map((r,i)=>`<li><button type="button" data-i="${i}" class="${i===cursor?'on':''}"><span class="fp">p. ${r.page}</span><span class="fs">${r.html}</span></button></li>`).join('');
    list.querySelector('.on')?.scrollIntoView({block:'nearest'});
  }
  function step(d){if(!results.length)return;cursor=(cursor+d+results.length)%results.length;render();goto(results[cursor].page);meta.textContent=`${cursor+1} of ${results.length}${results.length>=200?'+':''} results`}
  async function run(q){
    const my=++job;results=[];cursor=-1;list.innerHTML='';
    q=q.trim();
    if(q.length<2){meta.textContent='Type at least 2 letters';return}
    meta.textContent='Preparing search\u2026';
    try{await load()}catch{meta.textContent='Search is not available for this file';return}
    const needle=q.toLowerCase(),total=doc.numPages;let withText=0;
    for(let n=1;n<=total&&results.length<200;n++){
      if(my!==job)return;
      const t=await pageText(n);if(t)withText++;
      const low=t.toLowerCase();let from=0,idx,perPage=0;
      while((idx=low.indexOf(needle,from))!==-1&&perPage<3){
        const a=Math.max(0,idx-36),b=Math.min(t.length,idx+needle.length+54);
        results.push({page:n,html:`${a>0?'\u2026':''}${esc(t.slice(a,idx))}<mark>${esc(t.slice(idx,idx+needle.length))}</mark>${esc(t.slice(idx+needle.length,b))}${b<t.length?'\u2026':''}`});
        from=idx+needle.length;perPage++;
      }
      if(n%8===0||n===total){meta.textContent=`Searching\u2026 ${n}/${total} pages \u00B7 ${results.length} found`;if(n===8||results.length<=12)render()}
      if(n%4===0)await new Promise(r=>setTimeout(r));
    }
    if(my!==job)return;
    noText=withText===0;
    if(noText){meta.textContent='This PDF has no searchable text (it may be scanned images).';list.innerHTML='';return}
    if(!results.length){meta.textContent=`No results for \u201C${q}\u201D`;return}
    cursor=0;render();goto(results[0].page);meta.textContent=`1 of ${results.length}${results.length>=200?'+':''} results`;
  }
  form.addEventListener('submit',e=>{e.preventDefault();if(results.length&&input.value.trim().toLowerCase()===(form.dataset.q||'')){step(1);return}form.dataset.q=input.value.trim().toLowerCase();run(input.value)});
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){close();e.stopPropagation()}else if(e.key==='ArrowDown'){e.preventDefault();step(1)}else if(e.key==='ArrowUp'){e.preventDefault();step(-1)}});
  list.addEventListener('click',e=>{const b=e.target.closest('button[data-i]');if(!b)return;cursor=+b.dataset.i;render();goto(results[cursor].page);meta.textContent=`${cursor+1} of ${results.length} results`;if(matchMedia('(max-width:640px)').matches)close()});
  document.querySelector('#find-prev')?.addEventListener('click',()=>step(-1));
  document.querySelector('#find-next')?.addEventListener('click',()=>step(1));
  document.querySelector('#find-close')?.addEventListener('click',close);

  /* toolbar button, matches the other DearFlip buttons */
  let btn=null;
  function mount(){
    const more=book.querySelector('.df-ui-more');if(!more||book.querySelector('.df-ui-find'))return !!more;
    btn=document.createElement('div');btn.className='df-ui-btn df-ui-find ti-search';btn.title='Search in PDF (Ctrl+F)';btn.setAttribute('role','button');btn.setAttribute('aria-label','Search in PDF');
    btn.addEventListener('click',e=>{e.stopPropagation();toggle()});
    more.parentNode.insertBefore(btn,more);return true;
  }
  if(!mount()){const mo=new MutationObserver(()=>{if(mount())mo.disconnect()});mo.observe(book,{childList:true,subtree:true});setTimeout(()=>mo.disconnect(),20000)}
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();open()}});
  return{open,close};
}
