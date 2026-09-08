const layersFor = source => [
  {id:`${source}-landcover`,type:'fill',source,'source-layer':'landcover',paint:{'fill-color':['match',['get','class'],'wood','#d4e5c8','grass','#e4ecd2','sand','#efe2c5','#e7eadc'],'fill-opacity':0.9}},
  {id:`${source}-landuse`,type:'fill',source,'source-layer':'landuse',paint:{'fill-color':['match',['get','class'],'park','#d8e8c9','cemetery','#dfe7d5','hospital','#e9ded9','school','#eee7cf','#e8e9df'],'fill-opacity':0.78}},
  {id:`${source}-water`,type:'fill',source,'source-layer':'water',paint:{'fill-color':'#b7dbe4'}},
  {id:`${source}-waterway`,type:'line',source,'source-layer':'waterway',paint:{'line-color':'#8fc4d3','line-width':['interpolate',['linear'],['zoom'],9,0.7,15,2]}},
  {id:`${source}-buildings`,type:'fill',source,'source-layer':'building',minzoom:13,paint:{'fill-color':'#d8d4c9','fill-outline-color':'#c1baad'}},
  {id:`${source}-road-case`,type:'line',source,'source-layer':'transportation',filter:['!',['in',['get','class'],['literal',['path','track']]]],paint:{'line-color':'#d3d0c7','line-width':['interpolate',['linear'],['zoom'],7,0.7,16,8]}},
  {id:`${source}-roads`,type:'line',source,'source-layer':'transportation',filter:['!',['in',['get','class'],['literal',['path','track']]]],paint:{'line-color':['match',['get','class'],'motorway','#f0b154','trunk','#f3c471','primary','#f6d795','#fffdf5'],'line-width':['interpolate',['linear'],['zoom'],7,0.4,16,5]}},
  {id:`${source}-trails`,type:'line',source,'source-layer':'transportation',filter:['in',['get','class'],['literal',['path','track']]],paint:{'line-color':['match',['get','class'],'track','#987550','#557f55'],'line-width':['interpolate',['linear'],['zoom'],10,0.8,16,2.4],'line-dasharray':[2,2]}},
  {id:`${source}-boundaries`,type:'line',source,'source-layer':'boundary',paint:{'line-color':'#87977e','line-width':1,'line-dasharray':[4,3]}},
  {id:`${source}-poi`,type:'circle',source,'source-layer':'poi',minzoom:12,paint:{'circle-radius':3.2,'circle-color':'#755b3b','circle-stroke-color':'#fff','circle-stroke-width':1.2}},
  {id:`${source}-poi-label`,type:'symbol',source,'source-layer':'poi',minzoom:14,layout:{'text-field':['coalesce',['get','name:zh'],['get','name:en'],['get','name']],'text-size':11,'text-offset':[0.7,0],'text-anchor':'left','text-optional':true},paint:{'text-color':'#344239','text-halo-color':'#f7f8f1','text-halo-width':1.2}},
  {id:`${source}-places`,type:'symbol',source,'source-layer':'place',layout:{'text-field':['coalesce',['get','name:zh'],['get','name:en'],['get','name']],'text-size':['interpolate',['linear'],['zoom'],7,11,15,15],'text-optional':true},paint:{'text-color':'#24382e','text-halo-color':'#f8f9f3','text-halo-width':1.4}},
  {id:`${source}-house-numbers`,type:'symbol',source,'source-layer':'housenumber',minzoom:17,layout:{'text-field':['get','housenumber'],'text-size':10},paint:{'text-color':'#67675f','text-halo-color':'#f8f8f2','text-halo-width':1}},
];

export function offlineOutdoorStyle(packages) {
  const sources = {}, layers = [{id:'background',type:'background',paint:{'background-color':'#eef0e7'}}];
  for (const item of packages) {
    const id = `tp-${item.id}`;
    sources[id] = {type:'vector',url:`pmtiles://${item.protocolKey}`};
    layers.push(...layersFor(id));
  }
  return {version:8,name:'Trail Pocket Outdoor',sources,layers};
}
