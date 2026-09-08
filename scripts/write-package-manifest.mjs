import { stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';

const [id,name,boundsText,version,baseUrl,out='manifest.json'] = process.argv.slice(2);
if(!baseUrl)throw Error('usage: id name west,south,east,north version base-url output');
const files=[];
for(const logical of ['map.pmtiles','search.index','routing.graph']){
  const disk=`${id}-${logical}`, info=await stat(disk), digest=createHash('sha256');
  for await (const chunk of createReadStream(disk)) digest.update(chunk);
  const hash=digest.digest('hex');
  files.push({name:logical,size:info.size,sha256:hash,url:`${baseUrl.replace(/\/$/,'')}/${disk}`});
}
const manifest={schema:1,id,name,version,bounds:boundsText.split(',').map(Number),builtAt:new Date().toISOString(),osmDate:new Date().toISOString().slice(0,10),minAppVersion:'4.0.0',files};
await writeFile(out,JSON.stringify(manifest,null,2)+'\n');
