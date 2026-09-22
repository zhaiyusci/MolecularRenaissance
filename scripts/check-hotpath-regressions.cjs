'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=process.cwd(),baseline=path.join(root,'build/optimization-baseline-repo'),out=path.join(root,'build/optimization-test-logs');
fs.mkdirSync(out,{recursive:true});
// Optional historical fixtures are ignored by git; both trees must see the
// same fixtures or the baseline may silently skip assertions run in the app.
if(fs.existsSync(path.join(root,'build/baselines')))fs.cpSync(path.join(root,'build/baselines'),path.join(baseline,'build/baselines'),{recursive:true});
const files=['test-hotpath-math.cjs','test-approved-textures.cjs','test-element-textures.cjs','test-element-textures-ui.cjs','test-ortep-palette.cjs','test-ortep-ui.cjs','test-fast-ui.cjs','test-radii-scale.cjs','test-depth-fast.cjs','test-hatch-intervals.cjs','test-hatch-renderer.cjs','test-hatch-optimization.cjs','test-region-clipping.cjs','test-shared-regions.cjs','test-surface-lighting.cjs','test-surface-shadows.cjs','test-surface-tones.cjs','test-pattern-halftone.cjs','test-label-depth.cjs','test-orientation.cjs','test-orientation-ui.cjs','test-gizmo.cjs','test-typescript.cjs','test-boundary-rotations.cjs','test-c60-rotations.cjs','test-dot-rotations.cjs','test-analytic-boundaries.cjs','test-c60.cjs','test-dot-regions.cjs'];
const only=process.argv.slice(2);
const report=only.length?JSON.parse(fs.readFileSync('build/optimization-tests.json','utf8')):{note:'Selected geometry/lighting/texture/UI/module suites; failures rerun against committed baseline. Earlier unbounded full-suite attempt stopped in legacy test-dots.cjs. This is not a claim that every repository test passes.',rows:[]};
function run(file,cwd,label){const log=path.join(out,label+'-'+file+'.log'),fd=fs.openSync(log,'w');let r;try{r=cp.spawnSync(process.execPath,[file],{cwd,stdio:['ignore',fd,fd],timeout:file.includes('rotations')?90000:45000});}finally{fs.closeSync(fd);}if(r.error&&r.error.code!=='ETIMEDOUT')throw r.error;return {status:r.status,timedOut:r.error?.code==='ETIMEDOUT',log};}
for(const file of files.filter(f=>!only.length||only.includes(f))){
 const current=run(file,root,'current'),row={file,...current};
 if(current.status!==0&&fs.existsSync(path.join(baseline,file))){
  row.baseline=run(file,baseline,'baseline');
  const signature=log=>fs.readFileSync(log,'utf8').split(/\r?\n/).filter(line=>/^(FAIL|AssertionError|Error:)/.test(line));
  row.failureSignature=signature(current.log);row.baselineFailureSignature=signature(row.baseline.log);
  row.baselineAlsoFails=!current.timedOut&&!row.baseline.timedOut&&row.baseline.status!==0&&row.failureSignature.length>0&&JSON.stringify(row.failureSignature)===JSON.stringify(row.baselineFailureSignature);
 }
 const index=report.rows.findIndex(r=>r.file===file);if(index>=0)report.rows[index]=row;else report.rows.push(row);fs.writeFileSync('build/optimization-tests.json',JSON.stringify(report,null,2)+'\n');console.log(file+': '+(row.status===0?'PASS':row.baselineAlsoFails?'FAIL in baseline too':row.timedOut?'TIMEOUT':'NEW FAILURE'));
}
const failed=report.rows.filter(r=>r.status!==0&&!r.baselineAlsoFails);
console.log(JSON.stringify({passed:report.rows.filter(r=>r.status===0).length,baselineFailures:report.rows.filter(r=>r.baselineAlsoFails).map(r=>r.file),unresolved:failed.map(r=>r.file)}));
process.exitCode=failed.length?1:0;
