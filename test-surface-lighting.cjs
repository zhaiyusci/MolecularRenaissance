'use strict';
// Run after npm run build. Exact physical-light and serialized-stipple equivalence.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const urls=new Map();
function moduleURL(file){
  file=path.resolve(__dirname,'build/ts',file);
  if(urls.has(file))return urls.get(file);
  const source=fs.readFileSync(file,'utf8').replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_,q,ref)=>
    `from ${q}${moduleURL(path.resolve(path.dirname(file),ref))}${q}`);
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
  urls.set(file,url);return url;
}
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const mul=(a,k)=>a.map(v=>v*k);
const norm=a=>mul(a,1/Math.hypot(...a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function samples(s){
  const result=[];
  for(let k=0;k<73;k++){
    let n,p;
    if(s.kind==='sphere'){
      const z=1-2*(k+.5)/73,a=k*2.399963229728653,r=Math.sqrt(1-z*z);
      n=[r*Math.cos(a),r*Math.sin(a),z];p=s.c.map((v,i)=>v+s.r*n[i]);
    }else{
      const e=norm(cross(s.u,Math.abs(s.u[2])<.9?[0,0,1]:[0,1,0])),f=cross(s.u,e),a=k*2.399963229728653;
      n=e.map((v,i)=>v*Math.cos(a)+f[i]*Math.sin(a));
      const cap=k%3===0,t=cap?(k%2?s.length:0):s.length*(k+.5)/73;
      p=s.a.map((v,i)=>v+s.u[i]*t+n[i]*s.r*(cap?.7:1));
      if(cap)n=s.u.map(v=>v*(t?1:-1));
    }
    result.push({n,p});
  }
  return result;
}
(async()=>{
  const {prepareScene,depthAt}=await import(moduleURL('scene.js'));
  const {normalizeOptions}=await import(moduleURL('options.js'));
  const {shadowBlocked,directionalShadowContext}=await import(moduleURL('shadows.js'));
  const {buildDots}=require('./dots.js');
  const molecule={atoms:[
    {element:'C',position:[0,0,0],radius:1},
    {element:'H',position:[0,0,0],radius:.2}, // nested caster
    {element:'O',position:[1.5,.2,.1],radius:.8},
    {element:'C',position:[-.5,1,1],radius:.6},
    {element:'C',position:[2,0,3],radius:.7},
    {element:'H',position:[-2,-1,-2],radius:.4}
  ],bonds:[[0,2],[2,3],[3,4],[0,5]]};
  let checks=0,shadowHits=0,litHits=0;
  for(const lightType of ['directional','point'])for(const castShadows of [false,true])
  for(const lightAttenuation of [0,.3])for(const shadowStrength of [0,.8,1])
  for(const angles of [[0,0],[-.6,.7],[2,-.4]]){
    const o=normalizeOptions({lightType,castShadows,lightAttenuation,shadowStrength,lightAzimuth:angles[0],lightElevation:angles[1],shadingBrightness:.4});
    const prepared=prepareScene(molecule,o),{scene,lightDirection:light,shadowBias:bias}=prepared;
    const radius=Math.max(...prepared.spheres.map(s=>Math.hypot(...s.c)+s.r)),position=mul(light,o.lightDistance*radius);
    // Independent preservation of the pre-specialization physical evaluator.
    const oracle=(n,p)=>{
      const point=o.lightType==='point',delta=point?position.map((v,i)=>v-p[i]):light;
      const direction=point?norm(delta):light,distance=point?Math.hypot(...delta):Infinity;
      const facing=dot(n,direction);let lit=facing;
      if(point&&o.lightAttenuation>0){
        const relativeDistance=distance/radius;
        const attenuation=1/(1+o.lightAttenuation*relativeDistance*relativeDistance);
        lit=(Math.max(-1,Math.min(1,lit))+1)*attenuation-1;
      }
      if(o.castShadows&&o.shadowStrength>0&&o.shadingSize!==0&&facing>0&&shadowBlocked(scene,p,n,direction,distance,bias)){
        lit=(Math.max(-1,Math.min(1,lit))+1)*(1-o.shadowStrength)-1;shadowHits++;
      }else litHits++;
      return lit;
    };
    for(const s of scene){
      const lighting=prepared.lightingFor(s);
      assert.equal(lighting,prepared.lightingFor(s),'surface callback identity is cached');
      for(const {n,p} of samples(s)){
        const expected=oracle(n,p);
        assert.equal(prepared.illumination(n,p),expected,'generic physical arithmetic remains unchanged');
        assert.equal(lighting(n,p),expected,`${lightType} ${s.kind} surface lighting must agree exactly`);checks++;
      }
    }
    assert.equal(prepared.lightingFor({kind:'sphere',c:[100,0,0],r:1}),prepared.illumination,'unknown receiver uses generic fallback');
  }
  assert(shadowHits>0&&litHits>0,'exercise both blocked and unblocked light');
  const single={atoms:[{element:'C',position:[0,0,0]}],bonds:[]};
  for(const lightType of ['directional','point'])for(const castShadows of [false,true]){
    const p=prepareScene(single,normalizeOptions({lightType,castShadows}));
    assert.equal(p.mayShadow(p.scene[0]),castShadows&&lightType==='point','isolated directional surface has no candidates; point fallback is conservative');
  }
  for(const disabled of [{castShadows:false},{castShadows:true,shadowStrength:0},{castShadows:true,shadingSize:0}]){
    const p=prepareScene(molecule,normalizeOptions(disabled));
    assert(p.scene.every(s=>!p.mayShadow(s)),'disabled tracing never needs a shadow path');
  }
  // A bias-displaced receiver ray can meet a caster just outside the unpadded
  // bounding-sphere corridor. Candidate culling must include this fringe.
  const fringe=[{kind:'sphere',c:[0,0,0],r:1},{kind:'sphere',c:[1.5000001,0,3],r:.5}];
  assert(directionalShadowContext(fringe,[0,0,1],1e-6).candidates[0].includes(fringe[1]));
  for(const lightType of ['directional','point'])for(const withReference of [false,true]){
    const o=normalizeOptions({shadingMode:'stipple',lightType,castShadows:true,lightAttenuation:.2,scale:8,dotSize:.6,dotSpacing:2.5,width:200,height:200});
    const p=prepareScene(molecule,o),shift=.24;
    const reference=withReference?((s,n,lit)=>.15+.25*(1-lit)/2):undefined;
    const expected=buildDots(p.scene,depthAt,p.project,p.scale,(n,q)=>p.illumination(n,q)+shift,o,null,reference);
    let calls=0;
    const actual=buildDots(p.scene,depthAt,p.project,p.scale,()=>{throw Error('generic callback must not be used with surface lighting');},o,null,reference,
      {paths:null,illumination:(s,n,q)=>{calls++;return p.lightingFor(s)(n,q)+shift;}});
    assert(calls>0);assert(expected.includes('<circle'));
    assert.equal(actual,expected,'dot locations, seed consumption, radii, shrink and reference normalization are byte-identical');
  }
  console.log(`Surface lighting: ${checks} exact physical comparisons; 4 exact stipple SVG comparisons passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
