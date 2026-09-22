'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const dir='build/engine-bench';
const engines=['node-jit','node-jitless','quickjs-ng'];
const reports=Object.fromEntries(engines.map(e=>[e,JSON.parse(fs.readFileSync(`${dir}/${e}.json`,'utf8'))]));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const numbers=/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
// This comparison is diagnostic, not a proof of equal rendering. Numbers in IDs
// are included too; a false result requires inspecting differing SVG markup.
const rounded=s=>s.replace(numbers,n=>String(+Number(n).toFixed(6)));
const rows=[];
for(const ref of reports['node-jit'].rows) {
  const base=fs.readFileSync(`${dir}/node-jit-${ref.id}.svg`,'utf8');
  const row={id:ref.id,options:ref.options,timings:{},outputs:{}};
  for(const engine of engines) {
    const r=reports[engine].rows.find(x=>x.id===ref.id);
    if(!r)throw Error('Missing benchmark row '+engine+'/'+ref.id);
    if(JSON.stringify(r.options)!==JSON.stringify(ref.options))throw Error('Options differ');
    const svg=fs.readFileSync(`${dir}/${engine}-${ref.id}.svg`,'utf8');
    const tags=s=>s.match(/<\/?[A-Za-z][\w:-]*/g)||[];
    const meta={bytes:Buffer.byteLength(svg),sha256:hash(svg),byteIdenticalToV8:svg===base,tagSequenceMatchesV8:JSON.stringify(tags(svg))===JSON.stringify(tags(base)),sameAfterRoundingNumbersTo6Decimals:rounded(svg)===rounded(base)};
    if(svg!==base) {
      let offset=0;while(offset<Math.min(svg.length,base.length)&&svg[offset]===base[offset])offset++;
      meta.firstDifference={offset,v8:base.slice(Math.max(0,offset-60),offset+100),engine:svg.slice(Math.max(0,offset-60),offset+100)};
    }
    row.timings[engine]={firstMs:r.firstMs,samplesMs:r.timesMs,medianMs:r.medianMs,minMs:r.minMs,maxMs:r.maxMs,ratioToV8:r.medianMs/ref.medianMs};
    row.outputs[engine]=meta;
  }
  rows.push(row);
}
const summary={runtime:Object.fromEntries(engines.map(e=>[e,reports[e].runtime])),loadMs:Object.fromEntries(engines.map(e=>[e,reports[e].loadMs])),note:reports['node-jit'].note,rows};
fs.mkdirSync('benchmarks',{recursive:true});
fs.writeFileSync('benchmarks/native-quickjs.json',JSON.stringify(summary,null,2)+'\n');
console.table(rows.map(r=>({case:r.id,V8_ms:r.timings['node-jit'].medianMs.toFixed(2),jitless_ms:r.timings['node-jitless'].medianMs.toFixed(2),QuickJS_ms:r.timings['quickjs-ng'].medianMs.toFixed(2),QuickJS_slowdown:r.timings['quickjs-ng'].ratioToV8.toFixed(2),exact:r.outputs['quickjs-ng'].byteIdenticalToV8,rounded6:r.outputs['quickjs-ng'].sameAfterRoundingNumbersTo6Decimals})));
for(const r of rows)if(!r.outputs['quickjs-ng'].byteIdenticalToV8)console.log(JSON.stringify({case:r.id,quickjs:r.outputs['quickjs-ng']},null,2));
