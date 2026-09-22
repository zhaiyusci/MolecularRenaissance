'use strict';
// Run after the normal parent build: node test-ortep-palette.cjs.
// --source-only checks source tables and helper behavior without rebuilding artifacts.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const reference='references/ortep-colors/';
const records=name=>read(reference+name).split(/\r?\n/).filter(line=>line.trim()&&!line.trimStart().startsWith('#')).map(line=>line.trim().split(/\s+/));
const csv=read(reference+'element-colors.csv').trim().split(/\r?\n/).map(line=>line.split(','));
const header=csv.shift();
const rows=csv.map(values=>Object.fromEntries(header.map((key,i)=>[key,values[i]])));
// Independent integer arithmetic: round the original decimal * 255 without floating-point math.
function channel(decimal){
  assert.match(decimal,/^\d+\.\d+$/);
  const [whole,fraction]=decimal.split('.'),scale=10n**BigInt(fraction.length);
  const numerator=(BigInt(whole)*scale+BigInt(fraction))*255n;
  assert(numerator>=0n&&numerator<=255n*scale);
  return Number((2n*numerator+scale)/(2n*scale)).toString(16).padStart(2,'0');
}
const hex=values=>'#'+values.map(channel).join('');
const colors=new Map(records('rgbcols-base-1998.def').map(([name,...rgb])=>[name,hex(rgb)]));
for(const [name,...rgb] of records('rgbcols-overrides.def'))colors.set(name,hex(rgb));
assert.notEqual(colors.get('LightBlue'),colors.get('Lightblue'),'case-sensitive names must not conflate V with override Lightblue');
const atoms=records('atomcols.def');
assert.equal(rows.length,108);assert.equal(atoms.length,108);assert.equal(new Set(rows.map(row=>row.symbol)).size,108);
const expected=new Map();
for(let i=0;i<rows.length;i++){
  const row=rows[i],[symbol,color]=atoms[i];
  assert.equal(row.symbol,symbol);assert.equal(row.color_name,color);
  const value=colors.get(color);assert(value,`known original named color ${color}`);
  assert.equal(row.hex.toLowerCase(),value,`${symbol}: CSV hex matches original RGB decimals`);
  assert.equal(hex(['r','g','b'].map(key=>row[key])),value,`${symbol}: CSV decimals match original`);
  expected.set(symbol,value);
}
assert.match(read(reference+'atomcols.def'),/unknown = Pink/);
assert.equal(colors.get('Pink'),'#bc8f8f');
// Evaluate only the two DOM-free TS data/helper modules, using the existing dev dependency.
const ts=require('typescript'),cache=new Map();
function sourceModule(name){
  if(cache.has(name))return cache.get(name);
  assert(['palette','ortep-palette'].includes(name));
  const exports={};cache.set(name,exports);
  const code=ts.transpileModule(read('src/'+name+'.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:specifier=>sourceModule(specifier.replace(/^\.\//,'').replace(/\.js$/,''))});
  return exports;
}
const source=sourceModule('palette');
assert(Object.isFrozen(source.colorSchemes));assert(Object.isFrozen(source.colorSchemes.ortep));
assert.equal(Object.keys(source.colorSchemes.ortep).length,109,'108 original rows plus documented modern Db alias');
for(const [symbol,value] of expected)assert.equal(source.colorSchemes.ortep[symbol].toLowerCase(),value);
assert.equal(source.colorSchemes.ortep.Db,source.colorSchemes.ortep.Ha);
assert.match(read('src/ortep-palette.ts'),/Db[^\n]*aliases[^\n]*Ha/);
const legacy={jmol:['#ffffff','#909090','#3050f8','#ff0d0d','#ff8000','#ffff30'],rasmol:['#ffffff','#c8c8c8','#8f8fff','#f00000','#ffa500','#ffc832'],pymol:['#e6e6e6','#33ff33','#3333ff','#ff4d4d','#ff8000','#e6c640'],greenCarbon:['#ffffff','#00ff00','#8f8fff','#f00000','#ffa500','#ffc832'],cyanCarbon:['#ffffff','#00ffff','#8f8fff','#f00000','#ffa500','#ffc832'],magentaCarbon:['#ffffff','#ff00ff','#8f8fff','#f00000','#ffa500','#ffc832']};
const symbols=['H','C','N','O','P','S'];
function checkHelper(api){
  for(const [symbol,value] of expected){
    assert.equal(api.elementColor(symbol,1,1,'ortep'),value,`${symbol}: exact original lookup, normalized lowercase output`);
    assert.equal(api.elementColor(symbol,0,4,'ortep'),'#ffffff');
    const gray=api.elementColor(symbol,1,0,'ortep');
    assert.equal(gray.slice(1,3),gray.slice(3,5));assert.equal(gray.slice(3,5),gray.slice(5,7));
    for(const strength of [0,.25,1])for(const saturation of [0,1,4])assert.match(api.elementColor(symbol,strength,saturation,'ortep'),/^#[0-9a-f]{6}$/);
  }
  assert.deepEqual(symbols.map(e=>api.elementColor(e,1,1,'ortep')),['#ffffff','#007fff','#db70db','#ff0000','#ff8000','#ffff00']);
  assert.equal(api.elementColor('Db',1,1,'ortep'),api.elementColor('Ha',1,1,'ortep'));
  for(const unknown of [null,undefined,'','Xx','Og','__proto__','constructor','toString'])assert.equal(api.elementColor(unknown,1,1,'ortep'),'#bc8f8f');
  assert.equal(api.elementColor('O',.5,1,'ortep'),'#ff8080');
  assert.equal(api.elementColor('C',1,0,'ortep'),'#808080');
  assert.equal(api.elementColor('C',1,4,'ortep'),'#007fff','saturation caps at available HSL chroma');
  for(const bad of ['',null,'ORTEP','unknown','__proto__',0])assert.throws(()=>api.elementColor('C',1,1,bad),/Invalid colorScheme/);
  for(const [scheme,values] of Object.entries(legacy)){
    assert.deepEqual(symbols.map(e=>api.elementColor(e,1,1,scheme)),values,`${scheme}: unchanged originals`);
    for(const unknown of [null,undefined,'Xx','__proto__'])assert.equal(api.elementColor(unknown,1,1,scheme),values[1]);
    for(const e of symbols)assert.equal(api.elementColor(e,0,4,scheme),'#ffffff');
  }
}
checkHelper(source);
console.log('PASS original 108 CSV/ATOMCOLS/RGB rows, rounding, frozen table, Db alias, safe fallback and legacy palettes');
if(!process.argv.includes('--source-only'))main().catch(error=>{console.error(error);process.exitCode=1;});
async function main(){
  const cjs=require('./renderer.js'),esm=await import('./dist/molplotter.mjs'),browser=vm.createContext({});
  for(const name of ['dot-regions','boundaries','wash','dots','renderer'])vm.runInContext(read(name+'.js'),browser);
  assert.deepEqual(Object.keys(esm).sort(),Object.keys(cjs).sort(),'ESM/CJS export names unchanged');
  assert.deepEqual(Object.keys(browser.MolEngraver).sort(),Object.keys(cjs).sort(),'classic/CJS export names unchanged');
  for(const api of [cjs,esm,browser.MolEngraver])checkHelper(api);
  const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  const tags=(svg,role)=>[...svg.matchAll(/<[\w:-]+\b[^>]*>/g)].map(m=>attrs(m[0])).filter(a=>a['data-role']===role);
  const definitions=svg=>[...svg.matchAll(/<pattern\b[^>]*>[\s\S]*?<\/pattern>/g)].map(m=>m[0]).filter(mark=>mark.includes('data-role="element-pattern"'));
  // Option-derived namespaces include invisible palette choices. Preserve every
  // path, definition and style while replacing only one validated layered prefix.
  const stableIds=svg=>{const ids=[...new Set(svg.match(/\blh-[a-z0-9]+-[a-z0-9]+(?=-)/g)||[])];assert(ids.length<=1);if(ids.length)svg=svg.split(ids[0]).join('lh-NAMESPACE');return svg.replace(/fast-painter-[a-f0-9]+-[a-f0-9]+/g,'fast-painter-ID');};
  const elements=[...symbols,'Db','Xx'];
  const molecule={atoms:elements.map((element,i)=>({element,radius:.55,position:[(i%4)*2.5,Math.floor(i/4)*2.5,0]})),bonds:[[1,2]]};
  const base={width:360,height:240,scale:30,yaw:0,pitch:0,colorScheme:'ortep',colorWash:true,washStrength:1,colorSaturation:1,shadingSize:.5,shadingDensity:.5,labels:false,elementTextures:true};
  for(const renderMode of ['precise','fast'])for(const quality of ['preview','export'])for(const shadingMode of ['hatch','stipple','halftone']){
    const options={...base,renderMode,quality,shadingMode};
    const svg=cjs.render(molecule,options),fills=tags(svg,'surface-fill'),textures=tags(svg,'element-texture');
    assert.doesNotMatch(svg,/NaN|Infinity|undefined|<image\b|<script\b/);
    for(const element of elements)assert(fills.some(a=>a.fill===cjs.elementColor(element,1,1,'ortep')),`${renderMode}/${quality}/${shadingMode}: ${element} fill`);
    assert.equal(textures.length,elements.length);assert.equal(definitions(svg).length,elements.length);
    assert(textures.every(a=>+a['data-surface-id']<elements.length),'only atoms receive categorical patterns');
    // White bond is independent of the scheme's null/unknown Pink fallback.
    const withoutWhiteAtoms={atoms:[{element:'C',position:[-1.5,0,0]},{element:'O',position:[1.5,0,0]}],bonds:[[0,1]]};
    const bonded=cjs.render(withoutWhiteAtoms,options);
    assert(tags(bonded,'surface-fill').some(a=>a.fill==='#ffffff'),'visible bond stays white with ORTEP on');
    const off=cjs.render(molecule,{...options,colorWash:false});
    assert(tags(off,'surface-fill').every(a=>a.fill==='#ffffff'),'colorWash off leaves all surfaces white');
    assert.deepEqual(definitions(off),definitions(svg),'categorical texture recipes do not depend on color');
    assert.equal(stableIds(off),stableIds(cjs.render(molecule,{...options,colorWash:false,colorScheme:'jmol'})),'off is unchanged across schemes apart from option-derived IDs');
    for(const scheme of Object.keys(legacy)){
      const old=cjs.render(molecule,{...options,colorScheme:scheme});
      assert.deepEqual(definitions(old),definitions(svg),`${scheme}: textures unchanged`);
    }
    for(const [key,values] of Object.entries({washStrength:[0,1],colorSaturation:[0,4]}))for(const value of values){
      const result=cjs.render(molecule,{...options,[key]:value});
      const allowed=new Set(['#ffffff',...elements.map(e=>cjs.elementColor(e,key==='washStrength'?value:1,key==='colorSaturation'?value:1,'ortep'))]);
      assert(tags(result,'surface-fill').every(a=>allowed.has(a.fill)),`${key}=${value}: mixed fills`);
    }
    // Also exercise the wash path without categorical surface layers.
    const plain=cjs.render(molecule,{...options,elementTextures:false,shadingSize:0});
    assert(plain.includes('#007fff'));assert(plain.includes('#db70db'));assert(plain.includes('#bc8f8f'));
  }
  for(const colorScheme of ['',null,'ORTEP','__proto__',0])assert.throws(()=>cjs.render(molecule,{...base,colorScheme}),/colorScheme/);
  for(const [key,values] of Object.entries({washStrength:[-.01,1.01,NaN,Infinity,null,'1'],colorSaturation:[-.01,4.01,NaN,Infinity,null,'1']}))for(const value of values)assert.throws(()=>cjs.render(molecule,{...base,[key]:value}),/Invalid option|must be between/);
  const smoke={...base,shadingSize:0};
  for(const api of [esm,browser.MolEngraver])assert.equal(api.render(molecule,smoke),cjs.render(molecule,smoke),'distribution rendering parity');
  console.log('PASS ORTEP CJS/ESM/classic names and lookups; precise/fast × preview/export × shading modes; textures, wash limits and white bonds');
}
