import {areaKm2,project,validCoordinate} from './core.mjs';
import {validateArea,overlaps,contains,placeSearchURL,parsePlaceResults} from './explore-core.mjs';
import {OnlineMap} from './online-map.mjs';
import * as store from './storage.mjs';
import {downloadContours} from './terrain.mjs';
import {downloadOsmInChunks,assertStorageRoom,PACKAGE_LIMIT_BYTES,MAX_AREA_KM2} from './offline-download.mjs';
import {buildOfflinePackage} from './offline-package.mjs';
import {searchOffline} from './offline-search.mjs';

export function setupExplore(ctx){
  const $=id=>document.getElementById(id),map=ctx.map;
  let mode='online',selecting=false,ready=false,areas=[],routeMaps=[],timer,serial=0,job=null,lockedBounds=null,tileState={},loadedKey=null,lastSearch=0,searchJob=null;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,fn)=>{const b=el('button',text);b.onclick=fn;return b;};
  document.querySelector('.trail-tools').insertAdjacentHTML('beforebegin',`<div class="explore-tools"><label>底圖 <select id="baseMode"><option value="online">在線完整地圖</option><option value="offline">已下載離線底圖</option></select></label><button id="jumpPlace">前往位置</button><button id="selectArea" class="primary">▣ 選擇離線範圍</button></div><div id="exploreStatus" class="muted" role="status">拖動或縮放，瀏覽其他地區。</div><div id="areaControls" class="area-controls hide"><label>區域名稱 <input id="areaName" maxlength="100" placeholder="例如 Para Wirra 北部"></label><p id="areaSize" role="status"></p><div class="row"><button id="saveArea" class="primary">下載底圖及等高線</button><button id="cancelArea">取消選取</button><button id="abortArea" class="hide">取消下載</button></div><p class="fineprint">下載 OSM 道路、步道、水域、林地、建築物、設施及地名，並以開放高程資料產生約 20 m 間距等高線。大型範圍會自動分區下載和合併；每張地圖上限 500 km²／128 MB。</p></div>`);
  document.querySelector('.map-wrap').insertAdjacentHTML('beforeend','<div id="areaFrame" class="area-frame hide"><span>離線下載範圍</span></div>');
  $('offlineView').querySelector('.storage-card').insertAdjacentHTML('afterend','<section class="area-library"><div class="row"><h2>我的離線區域</h2><button id="chooseFromOffline">＋ 地圖選區</button></div><div id="areaList"></div><p id="areaEmpty">未有獨立區域。毋須 GPX／KML，可直接喺地圖揀位置下載。</p></section><h2>路線附近底圖</h2>');
  document.body.insertAdjacentHTML('beforeend',`<dialog id="jumpDialog"><h2>搜尋及選擇地圖位置</h2><p>優先搜尋已下載地圖，完全離線及不傳送關鍵字。需要其他地區時才按網上搜尋。</p><label for="placeSearch">地名、山峰或設施</label><input id="placeSearch" maxlength="120" autocomplete="off" placeholder="例如 Morialta、Toilets、Mount Lofty"><div class="row jump-actions"><button id="searchPlace" class="primary">搜尋已下載地圖</button><button id="searchOnline">搜尋網上</button><button id="jumpCurrent">◎ 使用目前位置</button></div><p id="placeStatus" class="muted" role="status"></p><div id="searchResults" class="search-results"></div><details><summary>常用地區或經緯度</summary><div id="placeChoices" class="row"></div><label>緯度<input id="jumpLat" type="number" min="-85" max="85" step="any" placeholder="例如 -34.68"></label><label>經度<input id="jumpLon" type="number" min="-180" max="180" step="any" placeholder="例如 138.82"></label><button id="jumpCoordinates">前往座標並框選</button></details><p class="fineprint">本機搜尋只讀取已下載地圖。按「搜尋網上」先會把文字傳送至 OpenStreetMap Nominatim；GPS 位置不會放入搜尋。新下載範圍會把矩形座標傳送至 Overpass。</p><button id="closeJump" class="primary">關閉</button></dialog>`);
  for(const [name,p,units] of [['阿德萊德',[138.6,-34.93],40],['Para Wirra',[138.82,-34.68],15],['Belair',[138.65,-35.0],15],['香港',[114.17,22.3],40]])$('placeChoices').append(button(name,()=>choose(p,name,units)));
  function jump(p,units){ctx.pauseFollow();ctx.nav('map');map.center=project(p);map.units=units;if(units===30000)map.fitBounds({west:-179.9,east:179.9,south:-85,north:85});else map.draw();$('jumpDialog').close();}
  function choose(p,name,units=20){jump(p,units);startSelection(name);}
  $('jumpPlace').textContent='搜尋／目前位置';$('jumpPlace').onclick=()=>{$('placeStatus').textContent='';$('searchResults').replaceChildren();$('jumpDialog').showModal();};$('closeJump').onclick=()=>$('jumpDialog').close();
  $('jumpCoordinates').onclick=()=>{const la=$('jumpLat').value,lo=$('jumpLon').value,p=[Number(lo),Number(la)];if(!la.trim()||!lo.trim()||!validCoordinate(p)){ctx.toast('請輸入有效經緯度（緯度 ±85°）。');return;}choose(p,'自選位置',10);};
  $('jumpCurrent').onclick=()=>{if(!isSecureContext||!navigator.geolocation){$('placeStatus').textContent='此瀏覽器未能使用目前位置。';return;}$('placeStatus').textContent='正在取得目前位置…';$('jumpCurrent').disabled=true;navigator.geolocation.getCurrentPosition(p=>{const point=[p.coords.longitude,p.coords.latitude];$('jumpCurrent').disabled=false;choose(point,'目前位置',15);},e=>{$('jumpCurrent').disabled=false;$('placeStatus').textContent=e.code===1?'未獲定位授權，請到瀏覽器設定允許定位。':'暫時未能取得位置，請到空曠位置再試。';},{enableHighAccuracy:true,maximumAge:30000,timeout:20000});};
  $('placeSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('searchPlace').click();}};
  $('searchPlace').onclick=async()=>{try{const records=[...await store.getAll('areas'),...await store.getAll('maps')],indexes=records.filter(r=>Array.isArray(r.searchIndex)).map(r=>({name:r.name||'路線底圖',index:r.searchIndex})),results=searchOffline(indexes,$('placeSearch').value,map.centerPoint());renderSearch(results,true);if(!indexes.length)$('placeStatus').textContent='已下載地圖屬舊版或未有搜尋索引，請重新下載。';}catch(e){$('placeStatus').textContent=ctx.failure(e);}};
  $('searchOnline').onclick=async()=>{if(searchJob)return;if(!navigator.onLine){$('placeStatus').textContent='目前離線，只能搜尋已下載地圖。';return;}let url;try{url=placeSearchURL($('placeSearch').value);}catch(e){$('placeStatus').textContent=ctx.failure(e);return;}const cacheKey='place:'+url.searchParams.get('q').toLocaleLowerCase(),cached=readSearchCache(cacheKey);if(cached){renderSearch(cached,false);return;}const wait=1000-(Date.now()-lastSearch);if(wait>0)await new Promise(r=>setTimeout(r,wait));const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);searchJob=controller;lastSearch=Date.now();$('searchOnline').disabled=true;$('placeStatus').textContent='正在搜尋網上地名…';try{const response=await fetch(url,{credentials:'omit',signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('搜尋服務回應 '+response.status);const results=parsePlaceResults(await response.json());writeSearchCache(cacheKey,results);renderSearch(results,false);}catch(e){$('placeStatus').textContent=e.name==='AbortError'?'搜尋逾時，請稍後重試。':'搜尋失敗：'+ctx.failure(e);}finally{clearTimeout(timeout);searchJob=null;$('searchOnline').disabled=false;}};
  function renderSearch(results,local=false){$('searchResults').replaceChildren();$('placeStatus').textContent=results.length?(local?`本機找到 ${results.length} 項；沒有傳送搜尋文字：`:'網上搜尋結果：'):(local?'已下載地圖內找不到；可改按「搜尋網上」。':'找不到地點，請加入城市、州或國家名稱再試。');for(const r of results){const label=local?`${r.name} · ${r.kind} · ${r.source}${Number.isFinite(r.metres)?' · '+(r.metres<1000?Math.round(r.metres)+' m':(r.metres/1000).toFixed(1)+' km'):''}`:r.name,b=button(label,()=>choose(r.point,r.name.split(',')[0],20));b.className='place-result';$('searchResults').append(b);}}
  function readSearchCache(key){try{const cache=JSON.parse(localStorage.getItem('trail-pocket-place-search')||'{}'),item=cache[key];return item&&Date.now()-item.saved<2592000000?parsePlaceResults(item.results.map(x=>({display_name:x.name,lon:x.point[0],lat:x.point[1]}))):null;}catch{return null;}}
  function writeSearchCache(key,results){try{const cache=JSON.parse(localStorage.getItem('trail-pocket-place-search')||'{}');cache[key]={saved:Date.now(),results};for(const k of Object.keys(cache).sort((a,b)=>cache[b].saved-cache[a].saved).slice(20))delete cache[k];localStorage.setItem('trail-pocket-place-search',JSON.stringify(cache));}catch{}}
  map.online=new OnlineMap(()=>map.draw(),s=>{tileState=s;status();});
  map.onViewChange=()=>{updateSelection();clearTimeout(timer);timer=setTimeout(()=>loadVisible().catch(e=>ctx.toast(ctx.failure(e))),250);};
  function status(){
    const online=mode==='online'&&navigator.onLine;
    if(online){const s=tileState;$('exploreStatus').textContent=s.failed?`部分在線底圖未載入（${s.failed} 張）。可按「重試底圖」，或切換已下載底圖。`:`在線地圖${s.total?` · ${s.loaded}/${s.total} 張已載入`:''} · 可自由拖動、縮放；瀏覽不等於離線下載。`;$('retryTiles').classList.toggle('hide',!s.failed);}
    else{const b=map.viewBounds(),near=[...areas,...routeMaps].filter(m=>overlaps(m.bounds,b)),old=near.some(m=>m.packageVersion<2),noContours=near.some(m=>!m.terrain);$('exploreStatus').textContent=(navigator.onLine?'離線預覽':'目前離線')+` · 畫面涵蓋 ${near.length} 個已下載範圍。`+(near.some(m=>contains(m.bounds,b))?'':'範圍外可能留白；可到「離線下載」開啟已儲存區域。')+(near.length?(old?' 其中有舊版地圖，請重新下載以加入完整圖層、搜尋及導航路網。':noContours?' 其中有舊底圖未含等高線；重新下載即可加入。':' 已包含完整圖層、等高線、本機搜尋及步道路網。'):'');$('retryTiles').classList.add('hide');}
    $('baseMode').value=mode;
  }
  const retry=button('重試底圖',()=>map.online.retry());retry.id='retryTiles';retry.className='hide';$('exploreStatus').after(retry);
  function syncMode(){map.online.setEnabled(mode==='online'&&navigator.onLine&&ctx.getView()==='map');map.draw();status();if(ready)loadVisible().catch(e=>ctx.toast(ctx.failure(e)));}
  $('baseMode').onchange=async()=>{mode=$('baseMode').value;loadedKey='';syncMode();try{await store.put('settings',{id:'baseMode',value:mode});}catch(e){ctx.toast(ctx.failure(e));}};
  for(const event of ['online','offline'])window.addEventListener(event,syncMode);
  async function refresh(){if(!ctx.isReady())return;areas=(await store.listMapMeta('areas')).sort((a,b)=>b.downloaded-a.downloaded);routeMaps=await store.listMapMeta();loadedKey=null;renderAreas();await loadVisible();status();}
  async function loadVisible(){
    if(!ready||ctx.getView()!=='map')return;
    const current=++serial;
    if(mode==='online'&&navigator.onLine){if(loadedKey!=='online'){map.setRegions([]);loadedKey='online';}return;}
    const b=map.viewBounds(),records=[...areas.map(a=>({...a,store:'areas'})),...routeMaps.map(a=>({...a,store:'maps'}))].filter(m=>overlaps(m.bounds,b));
    const key=records.map(m=>m.store+':'+m.id+':'+m.downloaded).join('|');if(key===loadedKey)return;
    const data=await Promise.all(records.map(m=>store.get(m.store,m.id)));if(current!==serial)return;loadedKey=key;map.setRegions(data.filter(Boolean));status();
  }
  function updateSelection(){
    if(!selecting)return;const b=lockedBounds||map.viewBounds(.15);let valid=true;
    const frame=$('areaFrame');if(lockedBounds){const a=map.screen(project([b.west,b.north])),z=map.screen(project([b.east,b.south]));frame.style.inset='auto';frame.style.left=a[0]+'px';frame.style.top=a[1]+'px';frame.style.width=(z[0]-a[0])+'px';frame.style.height=(z[1]-a[1])+'px';}else frame.removeAttribute('style');
    try{const size=validateArea(b);$('areaSize').textContent=`框內 ${size.toFixed(2)} km² · ${b.south.toFixed(4)}, ${b.west.toFixed(4)} 至 ${b.north.toFixed(4)}, ${b.east.toFixed(4)}`;}catch(e){valid=false;$('areaSize').textContent=ctx.failure(e);}
    $('saveArea').disabled=!valid||Boolean(job)||!navigator.onLine;
  }
  function startSelection(suggestedName=''){
    if(job){ctx.toast('請先等目前區域下載完成，或取消下載。');return;}if(!ctx.isReady()){ctx.toast('本機儲存未就緒。');return;}if(ctx.isEditing()){ctx.toast('請先完成自訂路線編輯。');return;}
    ctx.pauseFollow();ctx.nav('map');map.resize();selecting=true;lockedBounds=null;
    if(areaKm2(map.viewBounds(.15))>MAX_AREA_KM2)map.zoom(Math.sqrt(400/areaKm2(map.viewBounds(.15))));
    $('areaControls').classList.remove('hide');$('areaFrame').classList.remove('hide');$('areaProgress').textContent='';$('areaName').value=typeof suggestedName==='string'&&suggestedName.trim()?suggestedName.trim():'離線區域 '+(areas.length+1);updateSelection();
  }
  $('selectArea').onclick=$('chooseFromOffline').onclick=()=>startSelection();
  function cancelSelection(){if(job)return;selecting=false;lockedBounds=null;$('areaControls').classList.add('hide');$('areaFrame').classList.add('hide');}
  $('cancelArea').onclick=cancelSelection;$('abortArea').onclick=()=>job?.abort();
  const progress=el('p','','muted');progress.id='areaProgress';progress.setAttribute('role','status');$('areaSize').after(progress);
  $('saveArea').onclick=async()=>{
    if(job||ctx.jobs.size){ctx.toast('請等目前下載完成，或先取消。');return;}if(!navigator.onLine){ctx.toast('請連線後下載。');return;}
    let bounds,name;try{bounds=structuredClone(map.viewBounds(.15));validateArea(bounds);name=$('areaName').value.trim();if(!name)throw Error('請為離線區域命名。');}catch(e){ctx.toast(ctx.failure(e));return;}
    const id='area:'+crypto.randomUUID(),controller=new AbortController();job=controller;lockedBounds=bounds;ctx.jobs.set(id,controller);$('areaProgress').textContent='正在取得框內地圖…';$('abortArea').classList.remove('hide');$('cancelArea').disabled=true;$('areaName').disabled=true;$('selectArea').disabled=true;updateSelection();
    const timeout=setTimeout(()=>controller.abort('timeout'),600000);
    try{
      const osm=await downloadOsmInChunks(bounds,{signal:controller.signal,onProgress:p=>$('areaProgress').textContent=`正在下載地圖分區 ${p.index}/${p.total}${p.endpoint>1?'（備用服務）':''} · ${ctx.formatSize(p.transferred)}…`}),data=osm.data;if(controller.signal.aborted)throw Error('下載已取消。');$('areaProgress').textContent='正在建立離線搜尋及步道路網…';const extra=buildOfflinePackage(data);$('areaProgress').textContent='正在下載及產生 20 m 等高線…';const terrainResult=await downloadContours(bounds,{signal:controller.signal,onProgress:p=>$('areaProgress').textContent=`正在下載高程 ${p.done}/${p.total}…`}),record={id,name,bounds,data,...extra,contours:terrainResult.contours,terrain:terrainResult.terrain,parts:osm.parts,detailLevel:'完整離線圖層、搜尋及步道路網',downloaded:Date.now()};record.size=new Blob([JSON.stringify(record)]).size;if(record.size>PACKAGE_LIMIT_BYTES)throw Error('完整離線地圖連搜尋及步道路網超過 128 MB，請縮小範圍。');await assertStorageRoom(record.size);
      $('areaProgress').textContent='正在安全儲存…';await store.put('areas',record);
      await refresh();selecting=false;lockedBounds=null;$('areaControls').classList.add('hide');$('areaFrame').classList.add('hide');mode='offline';loadedKey=null;map.fitBounds(record.bounds);syncMode();ctx.toast('「'+name+'」底圖及等高線已儲存，現正預覽實際離線地圖。出發前請用飛行模式重開測試。');
    }catch(e){$('areaProgress').textContent=controller.signal.aborted?(controller.signal.reason==='timeout'?'下載超過 10 分鐘，未儲存新區域。':'已取消，未儲存新區域。'):'下載失敗：'+ctx.failure(e)+'。既有區域不受影響。';}
    finally{clearTimeout(timeout);ctx.jobs.delete(id);job=null;lockedBounds=null;$('abortArea').classList.add('hide');$('cancelArea').disabled=false;$('areaName').disabled=false;$('selectArea').disabled=false;updateSelection();ctx.storageInfo();}
  };
  function renderAreas(){
    $('areaList').replaceChildren();$('areaEmpty').classList.toggle('hide',areas.length>0);
    for(const a of areas){const card=el('article',undefined,'download-card'),detail=a.packageVersion>=2?`完整圖層 · ${a.stats?.searchEntries||0} 搜尋項 · ${a.stats?.routingNodes||0} 路網點 · 20 m 等高線`:'舊版地圖；重新下載可加入搜尋及路網';card.append(el('h3',a.name),el('p',`${areaKm2(a.bounds).toFixed(2)} km² · ${ctx.formatSize(a.size)} · ${detail} · ${new Date(a.downloaded).toLocaleString()}`));
      const row=el('div',undefined,'row');row.append(button('開啟離線區域',async()=>{if(ctx.isEditing()){ctx.toast('請先完成自訂路線編輯。');return;}ctx.pauseFollow();ctx.nav('map');map.resize();mode='offline';map.fitBounds(a.bounds);syncMode();}),button('刪除區域',async()=>{if(!await ctx.ask('刪除此離線區域？','「'+a.name+'」會從此裝置移除，可重新下載。GPX／KML 路線不受影響。'))return;try{await store.removeArea(a.id);await refresh();ctx.storageInfo();ctx.toast('離線區域已刪除，可重新下載。');}catch(e){ctx.toast(ctx.failure(e));}}));card.append(row);$('areaList').append(card);}
  }
  async function init(){ready=true;const saved=await store.get('settings','baseMode');if(['online','offline'].includes(saved?.value))mode=saved.value;await refresh();syncMode();}
  function viewChanged(){syncMode();if(ctx.getView()!=='map'&&!job)cancelSelection();}
  return {init,refresh,viewChanged,isSelecting:()=>selecting};
}
