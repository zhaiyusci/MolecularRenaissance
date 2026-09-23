'use strict';
const node=typeof process==='object'&&!!process.versions?.node;
const assert=node?require('node:assert/strict'):{equal(a,b,message){if(a!==b)throw Error(message+': '+a+' !== '+b);},ok(value,message){if(!value)throw Error(message);}};
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
// This file used to sweep n=-1000000..1000000 plus 8 wholes x 1000 tails x 7
// offsets plus 50000 xorshift draws: 2106018 comparisons that re-walked the same
// three tail-formatting branches and the same floor(n/1000)/n%1000 paths. Every
// distinct behaviour those sweeps could distinguish is listed explicitly below,
// and the finite 1000-entry tail table is enumerated in full rather than sampled.
// The cap sits just above the measured set so a later edit can add cases but cannot
// silently re-grow a bulk sweep over a continuous domain.
const MAX_COMPARISONS=4400;
// isTie proves a sampled case really lands on the exact half tie it claims; the
// positive/negative pair (0.0025, -0.0035) is the one a ties-to-even formatter
// would get wrong, so the +Infinity tie rule of Math.round stays pinned.
const isTie=v=>Math.abs(v*1000-Math.trunc(v*1000))===0.5;

// Non-finite inputs, signed zero and the extreme magnitudes of the double range.
// MAX_VALUE*1000 overflows to Infinity and MIN_VALUE*1000 rounds to 0, so both
// paths must agree on Infinity/NaN/0 rather than on digits. 1e15 is the last
// plain spelling here; 1e21 is the first exponential one.
for(const v of [NaN,Infinity,-Infinity,0,-0,Number.MIN_VALUE,-Number.MIN_VALUE,Number.MAX_VALUE,-Number.MAX_VALUE,Number.MAX_SAFE_INTEGER,-Number.MAX_SAFE_INTEGER,1e-7,-1e-7,1e15,-1e15,1e21,-1e21])check(v);

// Exact half ties, both signs (value*1000 lands on x.5, Math.round goes toward
// +Infinity). Covers ties that stay in the fraction, ties that carry into the
// integer part (0.9995->1, 1.9995->2, 999.9995->1000), ties that round toward
// zero instead of away (-0.9995->-0.999, -1.9995->-1.999), and the ties that
// land on or across the 1e9 fast-path gate at the end of the list.
for(const v of [0.0005,0.0015,0.0025,0.0035,0.0045,0.4995,0.9995,1.0005,1.9995,9.9995,99.9995,123.4565,999.9995,1000.9995,
 -0.0005,-0.0015,-0.0025,-0.0035,-0.9995,-1.0005,-1.9995,-9.9995,-99.9995,-123.4565,-999.9995,-1000.9995,
 999999.9995,-999999.9995,1000000.0005]){assert.ok(isTie(v),'expected an exact half tie for '+v);check(v);}

// The 1e-9 neighbours of those ties: the original sweep's d=+-.499999999 and
// d=+-.500000001 offsets, kept where the spacing of value*1000 is fine enough
// for them to be observable (at whole=1e6 they rounded away, so the sweep only
// produced duplicates there). These must land one scaled unit apart.
for(const v of [0.999499999,0.999500001,1.000499999,1.000500001,-0.999499999,-0.999500001,-1.000499999,-1.000500001])check(v);

// Signed zero: every input in [-0.0005, 0) scales to a -0 integer and must print
// "0" with no minus sign, while (0, 0.0005] prints "0" too. The positive and
// negative sides of the smallest non-zero result (0.001) are the tie cases above.
for(const v of [-0.0001,-0.0004,-0.00049,-0.000499999,0.0004,0.000499999])check(v);

// The private 1000-entry tail table is built by one of three expressions
// (i%100===0 -> '.1'..'.9', i%10===0 -> two digits, otherwise -> three
// zero-padded digits), so behaviour is uniform inside each class, inside each
// digit width and across signs. These indices cover all three classes, both
// leading-zero slices, the '' case (i=0) and the 9-heavy roundings, crossed
// with 1..7 digit integer parts: floor(n/1000) + tail and the '-' prefix must
// match native formatting for every combination.
const TAILS=[0,1,2,5,8,10,11,20,50,80,100,101,110,111,200,500,808,900,909,990,999];
const WIDTHS=[0,1,99,999,123456,999999];
for(const w of WIDTHS)for(const t of TAILS)for(const s of [1,-1])check(s*(w+t/1000));
// The tail table is finite and every entry is a distinct datum, so enumerate it in
// full instead of sampling it: a single-index typo outside the representative set
// above would otherwise survive. Two widths (one carry-prone, one not) and both
// signs read every entry, while width/tail interaction stays covered by the cross
// product above. This is the opposite of sweeping a continuous domain: there is no
// adjacent-point redundancy to drop here.
for(const w of [123456,999999])for(let i=0;i<1000;i++)for(const s of [1,-1])check(s*(w+i/1000));

// The precision limit the code enforces: the fast path applies only while
// -1e9 < Math.round(value*1000) < 1e9. These cases straddle that gate, and the
// expected side is asserted, so the gate constant cannot drift unnoticed.
const gate=(v,inside)=>{assert.equal(Math.round(v*1000)>-1e9&&Math.round(v*1000)<1e9,inside,'expected '+(inside?'fast-path':'fallback')+' side for '+v);check(v);};
gate(999999.999,true);   // n =  999999999, last fast-path integer
gate(-999999.999,true);  // n = -999999999, first fast-path integer
gate(1000000,false);     // n =  1e9 exactly, first fallback integer
gate(-1000000,false);    // n = -1e9 exactly, falls out of the gate
gate(999999.9995,false); // tie that carries up to exactly 1e9
gate(-999999.9995,true);// tie that rounds toward +Infinity, stays at -999999999
gate(1000000.0005,false);
// Past the gate the scaled integer is no longer a faithful thousandth: 1e20 has
// already left plain thousandths behind at 1e23 > 2^53 and prints as
// 99999999999999980000, while 1e21 is where String switches to exponent form
// and 2^53 / 1e300 stay in the native fallback.
for(const v of [1e13,-1e13,2**53,-(2**53),1e20,-1e20,1e22,-1e22,1e24,-1e24,1e300,-1e300])check(v);
// The exponent-notation switch itself: the native fallback spells plain digits
// for the whole [1e20, 1e21) band and only starts the exponent spelling at 1e21
// (and above). 1e20 scales to 9.999999999999998e19, just below the band, so the
// first plain value is sampled just above it, plus both ends of the band and the
// 1e21 cases above. Switching to exponential early, or spelling 1e21 in digits,
// changes every one of these.
for(const v of [1.0000000000000002e20,-1.0000000000000002e20,1.5e20,-1.5e20,9.999999999999999e20,-9.999999999999999e20])check(v);
// Where the integer/table path genuinely stops being exact. Divergence needs the
// spacing of Math.round(value*1000)/1000 to be coarse enough that two different
// thousandths collapse onto one double, which cannot happen below the analytic
// bound |Math.round(value*1000)| >= 2^43*1000 = 8796093022208000 (spacing there
// first reaches 2^-9 = 0.001953). 8796093022208.3 is the first divergent value
// found at that bound: the table path spells it 8796093022208.301 while native
// formatting spells it 8796093022208.3. The other two are the same effect at
// higher magnitudes (...428.222 instead of .223, ...389.226 instead of .227).
// Together they prove the 1e9 gate may not be widened to 8.8e15 or beyond - the
// native fallback is load-bearing, not decorative.
for(const v of [8796093022208.3,-8796093022208.3,9947609901428.223,-9947609901428.223,17782794100389.227,-17782794100389.227])check(v);

assert.ok(count<=MAX_COMPARISONS,`comparison count ${count} exceeds cap ${MAX_COMPARISONS}`);
console.log(`PASS ${count} exact SVG number comparisons over the chosen boundary set: signed zero, half ties, carries, the 1e9 fast-path gate, exponent switch and extreme fallback`);
