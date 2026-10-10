/* Recent PDF links (last 5). Only links are stored, never uploaded files. */
const KEY='ts-pdf-recent',MAX=5;
export function getRecents(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(r=>r&&typeof r.url==='string').slice(0,MAX):[]}catch{return[]}}
function save(list){try{localStorage.setItem(KEY,JSON.stringify(list.slice(0,MAX)))}catch{}}
export function addRecent(url,title){if(!url||/^(blob|data):/i.test(url))return;const list=getRecents().filter(r=>r.url!==url);list.unshift({url,title:title||url,ts:Date.now()});save(list)}
export function removeRecent(url){save(getRecents().filter(r=>r.url!==url))}
export function clearRecents(){try{localStorage.removeItem(KEY)}catch{}}
