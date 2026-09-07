const $ = id => document.getElementById(id);
const paths = {
 map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"/>',
 saved:'<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
 settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
 back:'<path d="m14 5-7 7 7 7"/>',
 layers:'<path d="m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4m-18 5 9 4 9-4"/>',
 location:'<circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
export function setupUnifiedUI(ctx) {
 const heading=document.createElement('section');heading.id='libraryHeader';heading.className='library-header hide';
 heading.innerHTML='<h1>我的</h1><div class="library-tabs" role="tablist" aria-label="我的分類"><button id="myRoutes" role="tab" aria-selected="true">路線</button><button id="myMaps" role="tab" aria-selected="false">離線地圖</button><button id="myActivities" role="tab" aria-selected="false">活動紀錄</button></div>';
 document.querySelector('main').prepend(heading);
 $('myRoutes').onclick=()=>ctx.nav('routes');$('myMaps').onclick=()=>ctx.nav('offline');$('myActivities').onclick=()=> $('activityHistory').click();
 window.addEventListener('trail:view',({detail:name})=>{
  heading.classList.toggle('hide',!['routes','offline','history'].includes(name));
  for(const [id,view] of [['myRoutes','routes'],['myMaps','offline'],['myActivities','history']]) $(id).setAttribute('aria-selected',String(view===name));
  $('mapToolMenu')?.removeAttribute('open');
 });
 for(const [tab,svg,label] of [['explore','map','地圖'],['saved','saved','我的'],['settings','settings','設定']]){
  const b=document.querySelector(`nav button[data-tab="${tab}"]`);b.innerHTML=icon(svg)+`<span>${label}</span>`;b.setAttribute('aria-label',label);
 }
 for(const [id,name,label] of [['back','back','返回我的'],['follow','location','返回目前位置'],['fit','map','顯示整條路線'],['zoomIn','plus','放大'],['zoomOut','minus','縮小']]){const b=$(id);b.innerHTML=icon(name);b.setAttribute('aria-label',label);}
 const menu=document.createElement('details');menu.id='mapToolMenu';menu.className='map-tool-menu';menu.innerHTML=`<summary aria-label="更多工具">${icon('more')}</summary><div class="map-tool-items"></div>`;
 document.querySelector('.map-wrap').append(menu);const items=menu.querySelector('div');
 for(const id of ['jumpPlace','selectArea']){const button=$(id);button.textContent=id==='jumpPlace'?'搜尋地點':'下載地圖範圍';items.append(button);}
 const tools=document.querySelector('.trail-tools');if(tools)items.append(tools);
 items.addEventListener('click',e=>{if(e.target.closest('button'))menu.open=false;});
 const extras=document.createElement('details');extras.className='library-actions';extras.innerHTML='<summary>新增及匯入</summary><div></div>';
 const row=extras.querySelector('div');
 const routeHeading=document.querySelector('#routesView .heading');
 for(const b of [...routeHeading.querySelectorAll('button')]){if(b.id==='import')row.append(b);else b.hidden=true;}
 const routeTools=document.querySelector('#routesView .route-tools');if(routeTools)for(const b of [...routeTools.querySelectorAll('button')])row.append(b);
 $('routesView').prepend(extras);
 $('settingsActivityHistory').hidden=true;
 $('closeActivityHistory').hidden=true;
 const extraHistory=$('activityHistory');extraHistory.hidden=true;
 document.querySelectorAll('.eyebrow,.activity-heading small').forEach(e=>e.hidden=true);
 document.querySelector('#routesView h1').textContent='路線';
 $('startActivity').textContent='開始活動';
 const downloadGuide=document.createElement('details');downloadGuide.className='settings-guide';downloadGuide.innerHTML='<summary>離線地圖格式及下載說明</summary>';
 for(const note of [...$('offlineView').querySelectorAll('.fineprint')])downloadGuide.append(note);
 $('settingsView').append(downloadGuide);
 for(const b of row.querySelectorAll('button'))b.textContent=b.textContent.replace(/^[＋✎▧]\s*/, '');
 for(const b of items.querySelectorAll('button'))b.textContent=b.textContent.replace(/^[☀⌁✎]\s*/, '');
 for(const [id,title]of [['settingsMapSource','地圖來源及 GeoPDF'],['settingsLayers','地圖圖層'],['settingsAlerts','偏离路線提醒']]){
  const b=$(id);b.querySelector('span').innerHTML=icon(id==='settingsMapSource'?'layers':id==='settingsLayers'?'map':'location');b.querySelector('i').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 5 7 7-7 7"/></svg>';
 }
}
