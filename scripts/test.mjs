import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const quick=process.argv.includes('--quick');
const slow=new Set(['test-c60-rotations.cjs','test-boundary-rotations.cjs','test-dot-rotations.cjs']);
const tests=fs.readdirSync(root).filter(name=>/^test(?:-.*)?\.cjs$/.test(name)).sort();
let count=0;
for(const file of tests){
 if(quick&&slow.has(file))continue;
 console.log('\n=== '+file+' ===');
 const result=spawnSync(process.execPath,[file,...(file==='test.cjs'?['--no-samples']:[])],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
 count++;
}
console.log(`\nPASS ${count} test scripts${quick?' (quick: rotation stress suites skipped)':''}`);
