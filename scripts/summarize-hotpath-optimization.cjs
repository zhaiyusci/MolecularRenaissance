'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const dir='build/engine-bench',engines=['node-jit','node-jitless','quickjs-ng'];
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const report={baselineCommit:'b351c7b',note:'Alternating before/after samples within each engine. Inspect all engines; a gain on QuickJS is not a guarantee of a gain everywhere.',runs:[]};
for(const suffix of ['-round1','']) {
  const files=engines.map(e=>`${dir}/optimization-${e}${suffix}.json`);
  if(!files.every(f=>fs.existsSync(f)))continue;
  const round={label:suffix?'round1':'latest',engines:Object.fromEntries(engines.map((e,i)=>[e,JSON.parse(fs.readFileSync(files[i],'utf8'))]))};
  report.runs.push(round);
}
report.outputChecks=[];
for(const row of report.runs.at(-1).engines['node-jit'].rows) {
  const base=fs.readFileSync(`build/engine-baseline/node-jit-${row.id}.svg`);
  const outputs=Object.fromEntries(engines.map(e=>{const b=fs.readFileSync(`${dir}/optimized-${e}-${row.id}.svg`);if(!b.equals(base))throw Error(`Output differs ${e}/${row.id}`);return [e,hash(b)];}));
  report.outputChecks.push({id:row.id,sha256:hash(base),outputs,byteIdentical:true});
}
report.parity=JSON.parse(fs.readFileSync('build/optimization-parity.json','utf8'));
report.tests=JSON.parse(fs.readFileSync('build/optimization-tests.json','utf8'));
if(report.tests.rows.some(r=>r.status!==0&&!r.baselineAlsoFails))throw Error('New or unresolved regression suite failure');
fs.writeFileSync('benchmarks/hotpath-optimization.json',JSON.stringify(report,null,2)+'\n');
for(const run of report.runs){console.log(run.label);for(const engine of engines){console.log(engine);console.table(run.engines[engine].rows.map(r=>({case:r.id,beforeMs:r.before.medianMs.toFixed(2),afterMs:r.after.medianMs.toFixed(2),speedup:r.speedup.toFixed(3),timeReductionPercent:(100*(1-r.after.medianMs/r.before.medianMs)).toFixed(1)})));}}
