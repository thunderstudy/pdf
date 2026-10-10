/* Shared PDF proxy used by server.mjs (Node) and functions/api/pdf.js (Cloudflare).
   Always answers with JSON {code,message} on failure so the reader can explain what went wrong. */
import{normalizePdfUrl,providerOf,PROVIDER_NAMES}from'./pdf-link.js';
export const MAX_BYTES=60*1024*1024;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Content-Length,X-Pdf-Error'};
const fail=(status,code,message)=>new Response(JSON.stringify({code,message}),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','X-Pdf-Error':code,'Cache-Control':'no-store'}});
export async function proxyPdf(raw){
  if(!raw)return fail(400,'bad_url','A PDF URL is required.');
  let target;try{target=new URL(normalizePdfUrl(raw))}catch{return fail(400,'bad_url','The PDF URL is invalid.')}
  if(!/^https?:$/.test(target.protocol))return fail(400,'bad_url','Only http and https links are supported.');
  const provider=providerOf(target.href);
  const name=provider?PROVIDER_NAMES[provider]:target.hostname;
  let up;
  try{up=await fetch(target,{redirect:'follow',headers:{Accept:'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8','User-Agent':'Mozilla/5.0 ThunderStudy PDF Reader'}})}
  catch{return fail(502,'unreachable',`Could not reach ${name}.`)}
  if(up.status===404||up.status===410)return fail(404,'not_found',`${name} says this file does not exist.`);
  if(up.status===401||up.status===403||up.status===429||up.status===451){
    return fail(403,provider?'not_public':'blocked',provider?`${name} refused access. The file is probably private.`:`${name} blocked access to this file.`);
  }
  if(!up.ok)return fail(502,'unreachable',`${name} returned an error (${up.status}).`);
  const type=(up.headers.get('content-type')||'').toLowerCase();
  if(type.includes('text/html'))return provider?fail(403,'not_public',`${name} returned a web page instead of the file. The file is probably private.`):fail(415,'not_pdf','The link opens a web page, not a PDF file.');
  const len=Number(up.headers.get('content-length')||0);
  if(len>MAX_BYTES)return fail(413,'too_large','This PDF is larger than 60 MB.');
  const headers=new Headers(cors);
  headers.set('Content-Type','application/pdf');headers.set('Cache-Control','public, max-age=3600');headers.set('Content-Disposition','inline');
  if(len)headers.set('Content-Length',String(len));
  let seen=0;
  const limiter=new TransformStream({transform(chunk,ctl){seen+=chunk.byteLength;if(seen>MAX_BYTES)ctl.error(new Error('too_large'));else ctl.enqueue(chunk)}});
  return new Response(up.body.pipeThrough(limiter),{status:200,headers});
}
