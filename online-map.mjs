import {visibleTiles} from './explore-core.mjs';

// Interactive visible tiles only. Never use this source in offline download jobs.
// Image requests retain browser HTTP caching and the page's normal Referer.
export class OnlineMap{
  constructor(redraw,status){this.redraw=redraw;this.status=status;this.cache=new Map();this.enabled=false;this.timer=null;this.visible=[];}
  setEnabled(enabled){this.enabled=enabled;if(!enabled)clearTimeout(this.timer);}
  retry(){for(const [key,v] of this.cache)if(v.failed)this.cache.delete(key);this.redraw();}
  draw(c,center,units,width,height){
    if(!this.enabled)return false;this.visible=visibleTiles(center,units,width,height);
    let loaded=0,failed=0;for(const t of this.visible){const item=this.cache.get(t.key);if(item?.loaded){c.drawImage(item.image,t.left,t.top,t.size+.5,t.size+.5);loaded++;item.used=Date.now();}else{if(item?.failed)failed++;c.fillStyle='#e6eade';c.fillRect(t.left,t.top,t.size+.5,t.size+.5);}}
    const state={loaded,failed,total:this.visible.length};this.status?.(state);
    clearTimeout(this.timer);this.timer=setTimeout(()=>this.loadVisible(),180);return true;
  }
  loadVisible(){
    if(!this.enabled)return;
    const keep=new Set(this.visible.map(t=>t.key));
    for(const t of this.visible){if(this.cache.has(t.key))continue;const image=new Image(),record={image,loaded:false,failed:false,used:Date.now()};this.cache.set(t.key,record);image.referrerPolicy='strict-origin-when-cross-origin';image.onload=()=>{record.loaded=true;if(this.enabled)this.redraw();};image.onerror=()=>{record.failed=true;if(this.enabled)this.redraw();};image.src=`https://tile.openstreetmap.org/${t.key}.png`;}
    if(this.cache.size>128){const old=[...this.cache].filter(([k])=>!keep.has(k)).sort((a,b)=>a[1].used-b[1].used);for(const [key] of old){if(this.cache.size<=128)break;this.cache.delete(key);}}
  }
}
