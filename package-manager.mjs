import { openPackageCatalog, openPackageFiles, packageCatalog } from './package-storage.mjs';
import { downloadPackage, repairPackage } from './package-downloader.mjs';
import { localPackageFile, packageBytes, validatePackageManifest } from './package-manifest.mjs';
import { searchPackageEntries } from './package-search.mjs';
import { mergePackageGraphs } from './package-routing.mjs';
import { sha256File } from './sha256.mjs';

const INDEX_URLS = [
  'https://github.com/appbuilderlee2/Trail-Pocket/releases/download/maps-v4-current/sa-index.json',
  'https://github.com/appbuilderlee2/Trail-Pocket/releases/download/maps-v4-pilot/sa-index.json',
];
const PRODUCTION_IDS = ['adelaide-mount-lofty','fleurieu-kangaroo-island','yorke-mid-north','eyre-peninsula','flinders-far-north','murraylands-riverland','limestone-coast'];
const mb = n => n >= 1048576 ? `${(n/1048576).toFixed(1)} MB` : `${Math.ceil(n/1024)} KB`;
const overlap = (a,b) => a[0] < b.east && a[2] > b.west && a[1] < b.north && a[3] > b.south;

export function setupPackageManager(ctx) {
  const root=document.createElement('section'); root.className='package-library';
  root.innerHTML='<div class="package-title"><div><span>V4 離線向量地圖</span><h2>南澳大利亞州</h2><p id="packageSummary">正在讀取地圖包目錄…</p></div><button id="downloadSouthAustralia" disabled>下載全部</button></div><div id="packageProgress" class="package-progress hide"><span></span><b></b><button id="pausePackage">暫停</button></div><div id="packageList" class="package-list"></div>';
  document.querySelector('#offlineView .heading').after(root);
  const $=id=>document.getElementById(id), manifests=new Map();
  let db,catalog,files,installed=[],downloads=[],controller,busy=false; const searchCache=new Map(),graphCache=new Map();
  function state(id){return downloads.find(x=>x.id===id)}
  function render() {
    const all=[...manifests.values()], production=PRODUCTION_IDS.map(id=>manifests.get(id)).filter(Boolean), ready=new Set(installed.filter(x=>x.state==='ready').map(x=>x.id));
    $('packageList').replaceChildren();
    for(const manifest of all){
      const row=document.createElement('div'), s=state(manifest.id), current=installed.find(x=>x.id===manifest.id&&x.state==='ready'), isReady=current?.version===manifest.version, hasUpdate=Boolean(current&&!isReady);
      const actionLabel=isReady?'已下載':s?.state==='paused'?'繼續':s?.state==='failed'?'修復':hasUpdate?'更新':'下載';
      row.className='package-row'; row.innerHTML=`<span class="package-state">${isReady?'✓':hasUpdate?'↻':'↓'}</span><div><b>${manifest.name}</b><small>${mb(packageBytes(manifest))}${hasUpdate?` · 已保留 ${current.version}`:''}${s?.state==='paused'?' · 可繼續':s?.state==='failed'?' · 需要修復':''}</small></div><div class="package-actions"><button>${actionLabel}</button>${!isReady&&['paused','failed'].includes(s?.state)?'<button class="package-cancel">取消</button>':''}</div>`;
      const button=row.querySelector('button'); button.disabled=busy||isReady; button.onclick=()=>confirmDownload([manifest],false);
      const cancel=row.querySelector('.package-cancel');if(cancel)cancel.onclick=()=>discard(manifest);
      $('packageList').append(row);
    }
    const currentCount=production.filter(manifest=>installed.some(item=>item.id===manifest.id&&item.version===manifest.version&&item.state==='ready')).length,
      full=production.length===7&&currentCount===7;
    $('packageSummary').textContent=full?'南澳完整離線 · 7/7 已驗證':production.length===7?`${currentCount}/7 個地區已驗證 · 下載後跨區自動拼合`:all.length?'測試地圖包已發布；全南澳目錄尚未齊備':'正式地圖包尚未發布；現有 v3 離線地圖不受影響';
    $('downloadSouthAustralia').disabled=busy||production.length!==7||full;
    $('downloadSouthAustralia').textContent=full?'已完整下載':'下載全部';
  }
  async function confirmDownload(items, all) {
    if(busy)return;
    const total=items.reduce((n,x)=>n+packageBytes(x),0), ok=await ctx.ask(all?'下載完整南澳？':'下載離線地圖？',`${items.length} 個地區，共 ${mb(total)}。大型下載建議使用 Wi-Fi；會先檢查空間，每個檔案完成 SHA-256 驗證後才可用。`,'開始下載');
    if(!ok)return;
    busy=true; controller=new AbortController(); render();
    $('packageProgress').classList.remove('hide');
    try{
      let prior=0,startedAt=0,startedBytes=0;
      for(let i=0;i<items.length;i++){
        const manifest=items[i];
        const action=state(manifest.id)?.state==='failed'?repairPackage:downloadPackage;
        await action(manifest,{files,catalog,signal:controller.signal,onProgress:p=>{
          if(!startedAt){startedAt=Date.now();startedBytes=prior+p.received;}
          const received=prior+p.received,ratio=total?received/total:0,elapsed=Math.max(1,(Date.now()-startedAt)/1000),speed=Math.max(0,(received-startedBytes)/elapsed),remaining=speed>1024?Math.ceil((total-received)/speed):null,
            eta=remaining===null?'計算剩餘時間…':remaining<60?`約 ${remaining} 秒`:`約 ${Math.ceil(remaining/60)} 分鐘`;
          $('packageProgress').querySelector('span').style.width=`${Math.round(ratio*100)}%`;
          $('packageProgress').querySelector('b').textContent=`${manifest.name} · 總計 ${Math.round(ratio*100)}% · ${eta} · ${i+1}/${items.length}`;
        }});
        prior+=packageBytes(manifest);
      }
      ctx.toast('離線地圖已下載並通過完整性驗證。');
    }catch(error){ctx.toast(error?.name==='AbortError'?'下載已暫停；下次由現有進度繼續。':ctx.failure(error));}
    finally{busy=false;controller=null;downloads=await catalog.list('downloads');installed=await catalog.list('packages');$('packageProgress').classList.add('hide');render();ctx.changed?.();}
  }
  $('downloadSouthAustralia').onclick=()=>confirmDownload(PRODUCTION_IDS.map(id=>manifests.get(id)),true);
  $('pausePackage').onclick=()=>controller?.abort();
  async function discard(manifest){if(busy)return;for(const entry of manifest.files)try{await files.remove(localPackageFile(manifest,entry));}catch{}await catalog.remove('downloads',manifest.id);downloads=await catalog.list('downloads');render();ctx.toast('未完成下載已取消及清除。');}
  async function init(){
    try{
      db=await openPackageCatalog(); catalog=packageCatalog(db); files=await openPackageFiles();
      [installed,downloads]=await Promise.all([catalog.list('packages'),catalog.list('downloads')]);
      for(const saved of await catalog.list('manifests'))try{manifests.set(saved.id,validatePackageManifest(saved));}catch{}
    }catch(error){$('packageSummary').textContent=error.message.includes('未支援')?error.message:'未能更新地圖包目錄；已下載地圖仍可使用';}
    render();
    if(navigator.onLine&&catalog)updateIndex().catch(()=>{});
  }
  async function updateIndex(){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{let response;for(const url of INDEX_URLS){response=await fetch(url,{cache:'no-store',signal:controller.signal});if(response.ok)break;}if(!response?.ok)return;const index=await response.json();if(index.schema!==1||!Array.isArray(index.packages))throw Error('地圖包目錄格式無效');for(const item of index.packages){const manifest=validatePackageManifest(item);manifests.set(manifest.id,manifest);await catalog.put('manifests',manifest);}render();}finally{clearTimeout(timer);}}
  async function search(query,center){const sources=[];for(const item of installed.filter(x=>x.state==='ready')){const file=item.files.find(x=>x.name==='search.index');if(!file?.local)continue;let index=searchCache.get(file.local);if(!index){index=JSON.parse(new TextDecoder().decode(await files.read(file.local)));if(index.version!==1||!Array.isArray(index.entries))throw Error(`${item.name} 搜尋索引損壞`);searchCache.set(file.local,index);}sources.push({name:item.name,entries:index.entries});}return searchPackageEntries(sources,query,center);}
  async function routingGraph(start,end){const corridor={west:Math.min(start[0],end[0])-.08,east:Math.max(start[0],end[0])+.08,south:Math.min(start[1],end[1])-.08,north:Math.max(start[1],end[1])+.08},selected=installed.filter(item=>item.state==='ready'&&overlap(item.bounds,corridor));if(!selected.some(x=>start[0]>=x.bounds[0]&&start[0]<=x.bounds[2]&&start[1]>=x.bounds[1]&&start[1]<=x.bounds[3])||!selected.some(x=>end[0]>=x.bounds[0]&&end[0]<=x.bounds[2]&&end[1]>=x.bounds[1]&&end[1]<=x.bounds[3]))return null;const graphs=[];for(const item of selected){const file=item.files.find(x=>x.name==='routing.graph');if(!file?.local)continue;let graph=graphCache.get(file.local);if(!graph){graph=JSON.parse(new TextDecoder().decode(await files.read(file.local)));graphCache.set(file.local,graph);}graphs.push(graph);}return graphs.length?{id:'pmtiles:'+selected.map(x=>x.id+':'+x.version).join('|'),downloaded:selected.map(x=>x.verifiedAt).join('|'),routingGraph:mergePackageGraphs(graphs)}:null;}
  async function audit(){const bad=[];for(const item of installed.filter(x=>x.state==='ready')){try{for(const file of item.files){const stat=await files.stat(file.local);if(stat?.size!==file.size||await sha256File(files,file.local,file.size)!==file.sha256)throw Error(file.name);}}catch{bad.push(item.name||item.id);await catalog.put('packages',{...item,state:'corrupt'});await catalog.put('downloads',{id:item.id,version:item.version,state:'failed',received:0,total:item.files.reduce((n,x)=>n+x.size,0),error:'完整性驗證失敗',updatedAt:Date.now()});}}if(bad.length){installed=await catalog.list('packages');downloads=await catalog.list('downloads');render();}return {checked:installed.filter(x=>x.state==='ready').length+bad.length,bad};}
  return {init,search,routingGraph,audit,covering:bounds=>installed.filter(item=>item.state==='ready'&&overlap(item.bounds,bounds)),listInstalled:()=>installed.filter(x=>x.state==='ready').map(({id,version,name,bounds})=>({id,version,name,bounds})),files:()=>files,pause:()=>controller?.abort(),refresh:async()=>{installed=await catalog.list('packages');downloads=await catalog.list('downloads');render();}};
}
