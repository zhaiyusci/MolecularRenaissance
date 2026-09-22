'use strict';
const node=typeof process==='object'&&!!process.versions?.node;
const assert=node?require('node:assert/strict'):{equal(a,b,message){if(a!==b)throw Error(message+': '+a+' !== '+b);}};
let rounded3;
if(node){
 const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
 const compiled=ts.transpileModule(fs.readFileSync('src/svg-number.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context={exports:{}};vm.runInNewContext(compiled,context);rounded3=context.exports.rounded3;
}else{
 // Native qjs --std --script test-svg-numbers.cjs, after npm run build.
 const compiled=std.loadFile('build/ts/svg-number.js');if(compiled===null)throw Error('Run npm run build first');
 rounded3=new Function(compiled.replace(/\bexport (?=function )/g,'')+'; return rounded3;')();
}
const reference=v=>String(Math.round(v*1000)/1000);let count=0;
function check(v){assert.equal(rounded3(v),reference(v),'value='+v);count++;}
// Exhaust every tail, both signs, repeated integer widths and carry boundaries.
for(let n=-1000000;n<=1000000;n++)check(n/1000);
for(const whole of [-1000001,-1000000,-999999,-123456,123456,999999,1000000,1000001])for(let f=0;f<1000;f++)for(const d of [-.500000001,-.5,-.499999999,0,.499999999,.5,.500000001])check(whole+(f+d)/1000);
for(const v of [NaN,Infinity,-Infinity,0,-0,Number.MIN_VALUE,-Number.MIN_VALUE,Number.MAX_VALUE,-Number.MAX_VALUE,Number.MAX_SAFE_INTEGER,-Number.MAX_SAFE_INTEGER,1e-7,-1e-7,1e15,-1e15,1e21,-1e21])check(v);
let seed=0x182371ab;for(let i=0;i<50000;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;check((seed|0)*Math.pow(10,(i%27)-16));}
console.log(`PASS ${count} exact SVG number comparisons, signed zero, half ties, carry boundaries and extreme fallback`);
