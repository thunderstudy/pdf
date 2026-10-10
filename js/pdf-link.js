/* Shared PDF link helpers (browser + server): share links -> direct file URLs.
   Supports Google Drive, Dropbox, OneDrive / SharePoint and GitHub. */
const host=u=>u.hostname.toLowerCase();
const b64url=s=>{const b=typeof btoa==='function'?btoa(s):Buffer.from(s).toString('base64');return b.replace(/=+$/,'').replace(/\//g,'_').replace(/\+/g,'-')};

export function driveId(input){
  let u;try{u=new URL(input)}catch{return null}
  if(!/(^|\.)(drive|docs)\.google\.com$|(^|\.)drive\.usercontent\.google\.com$/i.test(host(u)))return null;
  const m=u.pathname.match(/\/file\/(?:u\/\d+\/)?d\/([\w-]{10,})/)||u.pathname.match(/\/d\/([\w-]{10,})/);
  if(m)return m[1];
  const id=u.searchParams.get('id');
  return id&&/^[\w-]{10,}$/.test(id)?id:null;
}
export function isDriveFolder(input){
  try{const u=new URL(input);return /(^|\.)drive\.google\.com$/i.test(host(u))&&/\/drive\/(?:u\/\d+\/)?folders\//.test(u.pathname)}catch{return false}
}
/* 'drive' | 'dropbox' | 'onedrive' | 'github' | null */
export function providerOf(input){
  let u;try{u=new URL(input)}catch{return null}
  const h=host(u);
  if(/(^|\.)(drive|docs)\.google\.com$|(^|\.)drive\.usercontent\.google\.com$/.test(h))return 'drive';
  if(/(^|\.)dropbox\.com$|(^|\.)dropboxusercontent\.com$/.test(h))return 'dropbox';
  if(h==='1drv.ms'||h==='onedrive.live.com'||/(^|\.)sharepoint\.com$/.test(h)||h==='onedrive.com'||h==='api.onedrive.com')return 'onedrive';
  if(h==='github.com'||h==='raw.githubusercontent.com')return 'github';
  return null;
}
export const PROVIDER_NAMES={drive:'Google Drive',dropbox:'Dropbox',onedrive:'OneDrive',github:'GitHub'};
export function isFolderLink(input){
  if(isDriveFolder(input))return true;
  try{const u=new URL(input);if(providerOf(input)==='dropbox')return /^\/(sh|scl\/fo)\//.test(u.pathname);
    if(providerOf(input)==='github')return host(u)==='github.com'&&/^\/[^/]+\/[^/]+(\/tree\/.*)?\/?$/.test(u.pathname)&&!/\.pdf$/i.test(u.pathname)}catch{}
  return false;
}
/* Direct-download URL for a supported share link; unchanged if not recognised. */
export function normalizePdfUrl(input){
  let u;try{u=new URL(input)}catch{return input}
  const p=providerOf(input);
  if(p==='drive'){const id=driveId(input);return id?`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`:input}
  if(p==='dropbox'){
    if(host(u)==='dl.dropboxusercontent.com')return input;
    u.searchParams.delete('raw');u.searchParams.set('dl','1');return u.href;
  }
  if(p==='onedrive'){
    if(host(u)==='api.onedrive.com')return input;
    if(/sharepoint\.com$/.test(host(u))){u.searchParams.set('download','1');return u.href}
    return `https://api.onedrive.com/v1.0/shares/u!${b64url(input)}/root/content`;
  }
  if(p==='github'&&host(u)==='github.com'){
    const m=u.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/);
    if(m)return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  }
  return input;
}
/* True when we recognised a provider link but could not turn it into a file URL. */
export function isUnresolvedShare(input){const p=providerOf(input);return !!p&&!isFolderLink(input)&&normalizePdfUrl(input)===input&&!/raw\.githubusercontent|dl\.dropboxusercontent|api\.onedrive|drive\.usercontent/.test(input)&&!/\.pdf(\?|#|$)/i.test(input)}
/* Legacy name used by pdf.html */
export const isDriveLink=input=>providerOf(input)==='drive';
/* Friendly title guess from a URL */
export function titleFromUrl(input){
  try{const u=new URL(input),p=providerOf(input);
    const f=decodeURIComponent((u.pathname.split('/').filter(Boolean).pop()||'')).replace(/\.pdf$/i,'');
    if(f&&!/^(view|edit|download|root|content|preview)$/i.test(f)&&f.length<80&&p!=='drive')return f.replace(/[-_]+/g,' ');
    return p?`${PROVIDER_NAMES[p]} PDF`:(f?f.replace(/[-_]+/g,' '):host(u).replace(/^www\./,''));
  }catch{return 'Linked PDF'}
}
