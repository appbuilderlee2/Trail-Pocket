const dbName='trail-pocket:'+new URL('./',import.meta.url).pathname;
let db;
export async function openStore(){db=await new Promise((resolve,reject)=>{const r=indexedDB.open(dbName,3);r.onupgradeneeded=()=>{for(const name of ['routes','maps','settings','areas','activities'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('請關閉另一個舊版視窗，再重新開啟。'));});db.onversionchange=()=>db.close();}
export function transaction(names,mode,work){return new Promise((resolve,reject)=>{const t=db.transaction(names,mode);let value;try{value=work(t);}catch(e){t.abort();reject(e);return;}t.oncomplete=()=>resolve(value);t.onabort=t.onerror=()=>reject(t.error||Error('儲存失敗。'));});}
export function getAll(name){return new Promise((resolve,reject)=>{const r=db.transaction(name).objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export function get(name,id){return new Promise((resolve,reject)=>{const r=db.transaction(name).objectStore(name).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export function listMapMeta(name='maps'){return new Promise((resolve,reject)=>{const list=[],r=db.transaction(name).objectStore(name).openCursor();r.onsuccess=()=>{const c=r.result;if(!c){resolve(list);return;}const {data,...meta}=c.value;list.push(meta);c.continue();};r.onerror=()=>reject(r.error);});}
export const removeArea=id=>transaction(['areas'],'readwrite',t=>t.objectStore('areas').delete(id));
export const put=(name,value)=>transaction([name],'readwrite',t=>t.objectStore(name).put(value));
export const removeMap=id=>transaction(['maps'],'readwrite',t=>t.objectStore('maps').delete(id));
export const removeRoute=id=>transaction(['routes','maps'],'readwrite',t=>{t.objectStore('routes').delete(id);t.objectStore('maps').delete(id);});
export const importDemo=(route,map)=>transaction(['routes','maps'],'readwrite',t=>{t.objectStore('routes').put(route);t.objectStore('maps').put(map);});

export const finishActivity=activity=>transaction(['activities','settings'],'readwrite',t=>{t.objectStore('activities').put(activity);t.objectStore('settings').delete('active-activity');});
