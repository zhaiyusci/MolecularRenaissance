import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// The gate lane is what `npm test` runs on every change, so every script in it must
// stay in the seconds range. Exhaustive sweeps live in HEAVY and run through
// `npm run test:heavy`: a gate nobody is willing to wait for stops being a gate,
// which is how nine broken tests once merged unnoticed behind a ten minute suite.
// Membership is re-derived from measurement, not history: the shrunk sweeps moved
// back into the gate lane once they stopped being slow.
const HEAVY=new Set([
 'test-dots.cjs',
]);
const all=process.argv.includes('--all');
const heavyLane=process.argv.includes('--heavy');
const tests=fs.readdirSync(root).filter(name=>/^test(?:-.*)?\.cjs$/.test(name)).sort();
let count=0;
for(const file of tests){
 if(!all&&HEAVY.has(file)!==heavyLane)continue;
 console.log('\n=== '+file+' ===');
 const result=spawnSync(process.execPath,[file,...(file==='test.cjs'?['--no-samples']:[])],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
 count++;
}
console.log(`\nPASS ${count} test scripts${all?' (all lanes)':heavyLane?' (heavy lane)':' (gate lane; --all runs every script)'}`);
