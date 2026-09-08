import { setupUnifiedUI as setupBaseUnifiedUI } from './unified-ui-base.mjs';
import { OFFLINE_REGIONS } from './offline-regions.mjs';

const APP_VERSION='4.1.3';
const dispatchPreview=(bounds,label)=>window.dispatchEvent(new CustomEvent('trail:preview-bounds',{detail:{bounds,label}}));

function syncVisibleVersion(){
  const version=document.querySelector('.header-status .version');
  if(version)version.textContent=`v${APP_VERSION}`;
  const eyebrow=document.querySelector('#settingsView>.eyebrow');
  if(eyebrow)eyebrow.textContent=`TRAIL POCKET · V${APP_VERSION}`;
  const status=document.getElementById('updateCheckStatus');
  if(status&&/目前版本|最新版本|v4\.1\.[0-9]+/.test(status.textContent||''))status.textContent=`目前版本 v${APP_VERSION}`;
}

function loadOptionalEnhancements(){
  setTimeout(()=>{
    import('./v41-enhancements.mjs').catch(error=>{
      console.error('Trail Pocket optional UI enhancements failed to load',error);
    });
  },0);
}

export function setupUnifiedUI(ctx){
  try{
    setupBaseUnifiedUI(ctx);
  }catch(error){
    console.error('Trail Pocket unified UI failed; continuing with core UI',error);
  }
  syncVisibleVersion();
  queueMicrotask(syncVisibleVersion);
  window.addEventListener('trail:view',syncVisibleVersion);
  document.getElementById('checkAppUpdate')?.addEventListener('click',()=>setTimeout(syncVisibleVersion,9000));

  const list=document.getElementById('regionList');
  const parkByName=()=>new Map(OFFLINE_REGIONS.map(region=>[region.name,region]));

  const syncParkPreviews=()=>{
    if(!list)return;
    const parks=parkByName();
    for(const row of list.querySelectorAll('.region-row')){
      if(row.querySelector('.park-preview'))continue;
      const name=row.querySelector('h3')?.textContent?.trim(),region=parks.get(name),text=row.querySelector('h3')?.parentElement;
      if(!region||!text)continue;
      const preview=document.createElement('span');
      preview.className='park-preview';
      preview.setAttribute('role','button');
      preview.tabIndex=0;
      preview.textContent='預覽框選範圍';
      const open=event=>{event.preventDefault();event.stopPropagation();dispatchPreview(region.bounds,region.name);};
      preview.onclick=open;
      preview.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(event);}};
      text.append(preview);
    }
  };

  if(list)new MutationObserver(()=>requestAnimationFrame(syncParkPreviews)).observe(list,{childList:true,subtree:true});
  window.addEventListener('trail:parks-changed',()=>requestAnimationFrame(syncParkPreviews));
  window.addEventListener('trail:packages-changed',()=>requestAnimationFrame(syncParkPreviews));
  requestAnimationFrame(syncParkPreviews);
  loadOptionalEnhancements();
}
