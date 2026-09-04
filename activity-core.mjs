import {distance} from './core.mjs';
export function newActivity(route,now=Date.now()){
 return {id:crypto.randomUUID(),name:route?.name||'自由行山',routeId:route?.id||null,plannedLength:route?.length||null,created:now,status:'paused',elapsed:0,started:null,segments:[],distance:0,ascent:0,altitudeSamples:0,lastTimestamp:0,anchor:null,altAnchor:null};
}
export function elapsed(a,now=Date.now()){return a.elapsed+(a.status==='recording'?Math.max(0,now-a.started):0);}
export function resume(a,now=Date.now()){if(a.status==='recording')return;a.status='recording';a.started=now;a.anchor=null;a.altAnchor=null;}
export function pause(a,now=Date.now()){a.elapsed=elapsed(a,now);a.started=null;a.status='paused';a.anchor=null;a.altAnchor=null;}
export function checkpoint(a,now=Date.now()){return {...structuredClone(a),elapsed:elapsed(a,now),started:now,savedAt:now};}
export function metrics(a,now=Date.now()){const ms=elapsed(a,now),km=a.distance/1000;return {ms,km,speed:ms>0?km/(ms/3600000):0,pace:km>.01?ms/1000/km:null,remaining:a.plannedLength===null?null:Math.max(0,(a.plannedLength-a.distance)/1000),ascent:a.altitudeSamples>1?a.ascent:null};}
export function addFix(a,fix,now=Date.now()){
 if(a.status!=='recording')return '活動已暫停';
 const c=fix?.coords,t=fix?.timestamp;
 if(!c||![c.longitude,c.latitude,c.accuracy,t].every(Number.isFinite)||Math.abs(c.longitude)>180||Math.abs(c.latitude)>85||c.accuracy<0)return 'GPS 資料無效';
 if(t<a.started||t<=a.lastTimestamp||now-t>15000||t>now+2000)return '等候新 GPS 位置';
 a.lastTimestamp=t;
 if(c.accuracy>40){a.anchor=null;a.altAnchor=null;return 'GPS 精度不足，暫不累計距離';}
 const alt=Number.isFinite(c.altitude)&&Number.isFinite(c.altitudeAccuracy)&&c.altitudeAccuracy<=20&&c.altitudeAccuracy>=0?c.altitude:null;
 const p=[c.longitude,c.latitude,alt,t];let d=0;
 if(a.anchor){const dt=(t-a.anchor[3])/1000;d=distance(a.anchor,p);if(dt>30){a.anchor=null;a.altAnchor=null;d=0;}else if(d/dt>4.5){a.anchor=null;a.altAnchor=null;return 'GPS 跳點已忽略';}else if(d<Math.max(5,c.accuracy*.5))return '記錄中 · 已過濾細微 GPS 漂移';}
 if(a.segments.reduce((n,s)=>n+s.length,0)>=50000){pause(a,now);return '已達 50,000 點，請完成並開始另一個活動';}
 if(!a.anchor)a.segments.push([]);
 a.segments.at(-1).push(p);a.distance+=d;a.anchor=p;
 if(alt!==null){a.altitudeSamples++;if(a.altAnchor===null)a.altAnchor=alt;else if(Math.abs(alt-a.altAnchor)>=5){a.ascent+=Math.max(0,alt-a.altAnchor);a.altAnchor=alt;}}else a.altAnchor=null;
 return '記錄中 · GPS 精度 ±'+Math.round(c.accuracy)+' m';
}
export function clock(ms){const seconds=Math.floor(Math.max(0,ms)/1000),h=Math.floor(seconds/3600),m=Math.floor(seconds/60)%60,s=seconds%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s).padStart(2,'0');}
