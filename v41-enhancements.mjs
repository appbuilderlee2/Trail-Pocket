import * as store from './storage.mjs';

const $ = id => document.getElementById(id);
const once = (node, key) => {
  if (!node || node.dataset[key]) return false;
  node.dataset[key] = '1';
  return true;
};

function installStyles(){
  if ($('v41EnhancementStyles')) return;
  const style=document.createElement('style');
  style.id='v41EnhancementStyles';
  style.textContent=`
    .area-preview-note{margin:8px 0 2px;padding:10px 12px;border-radius:12px;background:#eef4e8;color:#315746;font-size:12px;line-height:1.55}
    .area-frame.previewing{box-shadow:0 0 0 4px rgba(63,137,91,.2),0 0 0 9999px rgba(20,53,39,.08);animation:areaPreviewPulse .8s ease 2}
    @keyframes areaPreviewPulse{50%{border-color:#7ee56d;box-shadow:0 0 0 7px rgba(126,229,109,.2),0 0 0 9999px rgba(20,53,39,.08)}}
    .activity-record-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.activity-record-actions button{margin-top:0!important}
    .activity-delete{color:#9a382f;border-color:#e5c9c4;background:#fff7f5}
    .area-preview-hint{font-size:11px;color:var(--muted);margin-top:8px}
  `;
  document.head.append(style);
}

function installSelectionPreview(){
  const controls=$('areaControls'),frame=$('areaFrame');
  if(!controls||!frame)return;
  let note=$('areaPreviewNote');
  if(!note){
    note=document.createElement('p');
    note.id='areaPreviewNote';
    note.className='area-preview-note';
    note.textContent='預覽：地圖上嘅藍色框就係即將下載嘅範圍。你可以先拖動／縮放地圖調整，確認後先下載。';
    $('areaSize')?.after(note);
  }
  const row=controls.querySelector('.row');
  if(row&&!$('previewSelectedArea')){
    const b=document.createElement('button');
    b.id='previewSelectedArea';
    b.type='button';
    b.textContent='預覽框選範圍';
    b.onclick=()=>{
      frame.classList.add('previewing');
      frame.querySelector('span') && (frame.querySelector('span').textContent='預覽：將下載此範圍');
      setTimeout(()=>frame.classList.remove('previewing'),1700);
    };
    row.insertBefore(b,$('saveArea'));
  }
}

async function enhanceAreaList(){
  const list=$('areaList');
  if(!list||!list.children.length)return;
  try{
    const areas=(await store.listMapMeta('areas')).sort((a,b)=>b.downloaded-a.downloaded);
    [...list.querySelectorAll('.download-card')].forEach((card,index)=>{
      const area=areas[index];
      if(!area)return;
      const buttons=[...card.querySelectorAll('button')];
      const open=buttons.find(b=>/開啟離線區域|預覽範圍/.test(b.textContent));
      if(open){
        open.textContent='預覽範圍';
        open.setAttribute('aria-label',`預覽 ${area.name} 框選範圍`);
      }
      if(!card.querySelector('.area-preview-hint')){
        const hint=document.createElement('p');
        hint.className='area-preview-hint';
        hint.textContent='按「預覽範圍」會回到地圖並完整框住呢個離線區域。';
        card.append(hint);
      }
    });
  }catch{}
}

async function enhanceActivityList(){
  const list=$('activityHistoryList');
  if(!list||!list.querySelector('.activity-record'))return;
  try{
    const items=(await store.getAll('activities')).sort((a,b)=>b.created-a.created);
    [...list.querySelectorAll('.activity-record')].forEach((card,index)=>{
      const activity=items[index];
      if(!activity||card.querySelector('.activity-record-actions'))return;
      const view=card.querySelector('button');
      const actions=document.createElement('div');
      actions.className='activity-record-actions';
      if(view)actions.append(view);
      const del=document.createElement('button');
      del.type='button';
      del.className='activity-delete';
      del.textContent='刪除';
      del.setAttribute('aria-label',`刪除活動 ${activity.name}`);
      del.onclick=async()=>{
        const ok=window.confirm(`刪除活動「${activity.name}」？\n\n只會刪除呢一條活動紀錄，其他活動、路線同離線地圖唔受影響。`);
        if(!ok)return;
        del.disabled=true;
        try{
          await store.transaction(['activities'],'readwrite',t=>t.objectStore('activities').delete(activity.id));
          card.remove();
          if(!list.querySelector('.activity-record')){
            const empty=document.createElement('p');empty.textContent='未有已完成活動。';list.append(empty);
          }
        }catch(error){
          del.disabled=false;
          alert(error?.message||'未能刪除活動。');
        }
      };
      actions.append(del);
      card.append(actions);
    });
  }catch{}
}

function boot(){
  installStyles();
  installSelectionPreview();
  enhanceAreaList();
  enhanceActivityList();
  const observer=new MutationObserver(()=>{
    installSelectionPreview();
    enhanceAreaList();
    enhanceActivityList();
  });
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('trail:view',()=>{
    requestAnimationFrame(()=>{enhanceAreaList();enhanceActivityList();installSelectionPreview();});
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
