/* Shared PDF link helpers: Google Drive share links -> direct download links */
export function driveId(input){
  let u;try{u=new URL(input)}catch{return null}
  if(!/(^|\.)drive\.google\.com$|(^|\.)drive\.usercontent\.google\.com$|(^|\.)docs\.google\.com$/i.test(u.hostname))return null;
  const m=u.pathname.match(/\/file\/(?:u\/\d+\/)?d\/([\w-]{10,})/)||u.pathname.match(/\/d\/([\w-]{10,})/);
  if(m)return m[1];
  const id=u.searchParams.get('id');
  return id&&/^[\w-]{10,}$/.test(id)?id:null;
}
export function isDriveFolder(input){
  try{const u=new URL(input);return /(^|\.)drive\.google\.com$/i.test(u.hostname)&&/\/drive\/(?:u\/\d+\/)?folders\//.test(u.pathname)}catch{return false}
}
export function isDriveLink(input){return !!driveId(input)||isDriveFolder(input)}
/* Returns a direct-download URL for Drive links, otherwise the URL unchanged. */
export function normalizePdfUrl(input){
  const id=driveId(input);
  return id?`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`:input;
}
