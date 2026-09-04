import {areaKm2,mapQuery,validateMap,project,validCoordinate} from './core.mjs';
import {validateArea,overlaps,contains} from './explore-core.mjs';
import {OnlineMap} from './online-map.mjs';
import * as store from './storage.mjs';

export function setupExplore(ctx){
  const $=id=>document.getElementById(id),map=ctx.map;
  let mode='online',selecting=false,ready=false,areas=[],routeMaps=[],timer,serial=0,job=null,lockedBounds=null,tileState={},loadedKey=null;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,fn)=>{const b=el('button',text);b.onclick=fn;return b;};
  document.querySelector('.trail-tools').insertAdjacentHTML('beforebegin',`<div class="explore-tools"><label>底圖 <select id="baseMode"><option value="online">在線完整地圖</option><option value="offline">已下載離線底圖</option></select></label><button id="jumpPlace">前往位置</button><button id="selectArea" class="primary">▣ 選擇離線範圍</button></div><div id="exploreStatus" class="muted" role="status">拖動或縮放，瀏覽其他地區。</div><div id="areaControls" class="area-controls hide"><label>區域名稱 <input id="areaName" maxlength="100" placeholder="例如 Para Wirra 北部"></label><p id="areaSize" role="status"></p><div class="row"><button id="saveArea" class="primary">下載框內底圖</button><button id="cancelArea">取消選取</button><button id="abortArea" class="hide">取消下載</button></div><p class="fineprint">下載 OSM 道路、步道、水域、林地、建築物、設施及地名。配色及細節與在線地圖不同；不包含在線圖磚、衛星或等高線。每區上限 150 km²／32 MB；若完整資料超出上限，請縮小範圍。</p></div>`);
  document.querySelector('.map-wrap').insertAdjacentHTML('beforeend','<div id="areaFrame" class="area-frame hide"><span>離線下載範圍</span></div>');
  $('offlineView').querySelector('.storage-card').insertAdjacentHTML('afterend','<section class="area-library"><div class="row"><h2>我的離線區域</h2><button id="chooseFromOffline">＋ 地圖選區</button></div><div id="areaList"></div><p id="areaEmpty">未有獨立區域。毋須 GPX／KML，可直接喺地圖揀位置下載。</p></section><h2>路線附近底圖</h2>');
  document.body.insertAdjacentHTML('beforeend',`<dialog id="jumpDialog"><h2>前往位置</h2><p>揀一個地區，或者輸入經緯度，再喺地圖拖動／縮放。</p><div id="placeChoices" class="row"></div><label>緯度<input id="jumpLat" type="number" min="-85" max="85" step="any" placeholder="例如 -34.68"></label><label>經度<input id="jumpLon" type="number" min="-180" max="180" step="any" placeholder="例如 138.82"></label><button id="jumpCoordinates">前往座標</button><button id="closeJump" class="primary">關閉</button></dialog>`);
  for(const [name,p,units] of [['阿德萊德',[138.6,-34.93],80],['Para Wirra',[138.82,-34.68],15],['Belair',[138.65,-35.0],15],['香港',[114.17,22.3],60],['世界',[20,15],30000]])$('placeChoices').append(button(name,()=>jump(p,units)));
  function jump(p,units){ctx.pauseFollow();ctx.nav('map');map.center=project(p);map.units=units;if(units===30000)map.fitBounds({west:-179.9,east:179.9,south:-85,north:85});else map.draw();$('jumpDialog').close();}
  $('jumpPlace').onclick=()=>$('jumpDialog').showModal();$('closeJump').onclick=()=>$('jumpDialog').close();
  $('jumpCoordinates').onclick=()=>{const la=$('jumpLat').value,lo=$('jumpLon').value,p=[Number(lo),Number(la)];if(!la.trim()||!lo.trim()||!validCoordinate(p)){ctx.toast('請輸入有效經緯度（緯度 ±85°）。');return;}jump(p,10);};
  map.online=new OnlineMap(()=>map.draw(),s=>{tileState=s;status();});
  map.onViewChange=()=>{updateSelection();clearTimeout(timer);timer=setTimeout(()=>loadVisible().catch(e=>ctx.toast(ctx.failure(e))),250);};
  function status(){
    const online=mode==='online'&&navigator.onLine;
    if(online){const s=tileState;$('exploreStatus').textContent=s.failed?`部分在線底圖未載入（${s.failed} 張）。可按「重試底圖」，或切換已下載底圖。`:`在線地圖${s.total?` · ${s.loaded}/${s.total} 張已載入`:''} · 可自由拖動、縮放；瀏覽不等於離線下載。`;$('retryTiles').classList.toggle('hide',!s.failed);}
    else{const b=map.viewBounds(),near=[...areas,...routeMaps].filter(m=>overlaps(m.bounds,b)),old=near.some(m=>m.detailLevel!=='建築物及地標');$('exploreStatus').textContent=(navigator.onLine?'離線預覽':'目前離線')+` · 畫面涵蓋 ${near.length} 個已下載範圍。`+(near.some(m=>contains(m.bounds,b))?'':'範圍外可能留白；可到「離線下載」開啟已儲存區域。')+(old?' 其中有舊版／基本底圖，不含建築物；請到「離線下載」重新下載。':'');$('retryTiles').classList.add('hide');}
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
  function startSelection(){
    if(job){ctx.toast('請先等目前區域下載完成，或取消下載。');return;}if(!ctx.isReady()){ctx.toast('本機儲存未就緒。');return;}if(ctx.isEditing()){ctx.toast('請先完成自訂路線編輯。');return;}
    ctx.pauseFollow();ctx.nav('map');map.resize();selecting=true;lockedBounds=null;
    if(areaKm2(map.viewBounds(.15))>150)map.zoom(Math.sqrt(100/areaKm2(map.viewBounds(.15))));
    $('areaControls').classList.remove('hide');$('areaFrame').classList.remove('hide');$('areaProgress').textContent='';$('areaName').value='離線區域 '+(areas.length+1);updateSelection();
  }
  $('selectArea').onclick=$('chooseFromOffline').onclick=startSelection;
  function cancelSelection(){if(job)return;selecting=false;lockedBounds=null;$('areaControls').classList.add('hide');$('areaFrame').classList.add('hide');}
  $('cancelArea').onclick=cancelSelection;$('abortArea').onclick=()=>job?.abort();
  async function readDownload(response,signal){
    if(!response.ok)throw Error('地圖服務回應 '+response.status);const limit=32*1024*1024;if(Number(response.headers.get('content-length'))>limit)throw Error('範圍資料超過 32 MB，請縮細範圍。');
    if(!response.body){const text=await response.text();if(new Blob([text]).size>limit)throw Error('資料超過 32 MB。');return JSON.parse(text);}
    const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
    while(true){if(signal.aborted){await reader.cancel();throw Error('下載已取消。');}const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>limit){await reader.cancel();throw Error('資料超過 32 MB，請縮細範圍。');}text+=decoder.decode(chunk.value,{stream:true});$('areaProgress').textContent='正在下載 '+ctx.formatSize(size)+'…';}
    return JSON.parse(text+decoder.decode());
  }
  const progress=el('p','','muted');progress.id='areaProgress';progress.setAttribute('role','status');$('areaSize').after(progress);
  $('saveArea').onclick=async()=>{
    if(job||ctx.jobs.size){ctx.toast('請等目前下載完成，或先取消。');return;}if(!navigator.onLine){ctx.toast('請連線後下載。');return;}
    let bounds,name,query;try{bounds=structuredClone(map.viewBounds(.15));validateArea(bounds);name=$('areaName').value.trim();if(!name)throw Error('請為離線區域命名。');query=mapQuery(bounds);}catch(e){ctx.toast(ctx.failure(e));return;}
    const id='area:'+crypto.randomUUID(),controller=new AbortController();job=controller;lockedBounds=bounds;ctx.jobs.set(id,controller);$('areaProgress').textContent='正在取得框內地圖…';$('abortArea').classList.remove('hide');$('cancelArea').disabled=true;$('areaName').disabled=true;$('selectArea').disabled=true;updateSelection();
    const timeout=setTimeout(()=>controller.abort('timeout'),150000);let data,error;
    try{
      for(const endpoint of ['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter']){const attempt=new AbortController(),cancel=()=>attempt.abort(controller.signal.reason),attemptTimer=setTimeout(()=>attempt.abort('endpoint-timeout'),65000);controller.signal.addEventListener('abort',cancel,{once:true});try{const response=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:query}),credentials:'omit',signal:attempt.signal});data=validateMap(await readDownload(response,attempt.signal));break;}catch(e){error=e;if(controller.signal.aborted)throw e;$('areaProgress').textContent='服務暫時未完成，正嘗試備用服務…';}finally{clearTimeout(attemptTimer);controller.signal.removeEventListener('abort',cancel);}}
      if(!data)throw error;if(controller.signal.aborted)throw Error('下載已取消。');
      const record={id,name,bounds,data,detailLevel:'建築物及地標',downloaded:Date.now(),size:new Blob([JSON.stringify(data)]).size};$('areaProgress').textContent='正在儲存…';await store.put('areas',record);
      await refresh();selecting=false;lockedBounds=null;$('areaControls').classList.add('hide');$('areaFrame').classList.add('hide');mode='offline';loadedKey=null;map.fitBounds(record.bounds);syncMode();ctx.toast('「'+name+'」已儲存，現正預覽實際離線底圖。出發前請用飛行模式重開測試。');
    }catch(e){$('areaProgress').textContent=controller.signal.aborted?(controller.signal.reason==='timeout'?'下載逾時，未儲存新區域。':'已取消，未儲存新區域。'):'下載失敗：'+ctx.failure(e)+'。既有區域不受影響。';}
    finally{clearTimeout(timeout);ctx.jobs.delete(id);job=null;lockedBounds=null;$('abortArea').classList.add('hide');$('cancelArea').disabled=false;$('areaName').disabled=false;$('selectArea').disabled=false;updateSelection();ctx.storageInfo();}
  };
  function renderAreas(){
    $('areaList').replaceChildren();$('areaEmpty').classList.toggle('hide',areas.length>0);
    for(const a of areas){const card=el('article',undefined,'download-card');card.append(el('h3',a.name),el('p',`${areaKm2(a.bounds).toFixed(2)} km² · ${ctx.formatSize(a.size)} · ${a.detailLevel||'舊版基本地形；重載可加入建築物'} · ${new Date(a.downloaded).toLocaleString()}`));
      const row=el('div',undefined,'row');row.append(button('開啟離線區域',async()=>{if(ctx.isEditing()){ctx.toast('請先完成自訂路線編輯。');return;}ctx.pauseFollow();ctx.nav('map');map.resize();mode='offline';map.fitBounds(a.bounds);syncMode();}),button('刪除區域',async()=>{if(!await ctx.ask('刪除此離線區域？','「'+a.name+'」會從此裝置移除，可重新下載。GPX／KML 路線不受影響。'))return;try{await store.removeArea(a.id);await refresh();ctx.storageInfo();ctx.toast('離線區域已刪除，可重新下載。');}catch(e){ctx.toast(ctx.failure(e));}}));card.append(row);$('areaList').append(card);}
  }
  async function init(){ready=true;const saved=await store.get('settings','baseMode');if(['online','offline'].includes(saved?.value))mode=saved.value;await refresh();syncMode();}
  function viewChanged(){syncMode();if(ctx.getView()!=='map'&&!job)cancelSelection();}
  return {init,refresh,viewChanged,isSelecting:()=>selecting};
}
