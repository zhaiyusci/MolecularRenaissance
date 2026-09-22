// Focused checks for conservative per-receiver shadow candidate filtering.
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>{const r=Math.hypot(...a);return a.map(v=>v/r);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
(async()=>{
  const module=await import('data:text/javascript;base64,'+readFileSync('build/ts/shadows.js').toString('base64'));
  const scene=[
    {kind:'sphere',c:[0,0,0],r:1},
    {kind:'sphere',c:[0,0,0],r:.2}, // wholly contained; never casts outward
    {kind:'sphere',c:[1.5,.2,.1],r:.8},
    {kind:'sphere',c:[-.5,1,1],r:.6},
    {kind:'sphere',c:[2,0,3],r:.7},
    {kind:'cylinder',a:[0,0,0],u:norm([1,.2,.1]),length:1.7,r:.2},
    {kind:'cylinder',a:[-.5,-1,.3],u:norm([.3,1,.2]),length:2,r:.2},
    {kind:'cylinder',a:[.5,-.2,0],u:[0,0,1],length:2,r:.3}
  ];
  const samples=[];
  scene.forEach((s,id)=>{
    for(let k=0;k<61;k++){
      let p,n;
      if(s.kind==='sphere'){
        const z=1-2*(k+.5)/61,a=k*2.399963229728653,r=Math.sqrt(1-z*z);
        n=[r*Math.cos(a),r*Math.sin(a),z];p=s.c.map((v,i)=>v+s.r*n[i]);
      }else{
        const e=norm(cross(s.u,Math.abs(s.u[2])<.9?[0,0,1]:[0,1,0])),f=cross(s.u,e),a=k*2.399963229728653;
        n=e.map((v,i)=>v*Math.cos(a)+f[i]*Math.sin(a));
        let t=s.length*(k+.5)/61,rad=s.r;
        if(k%3===0){t=k%2?s.length:0;rad=s.r*.7;}
        p=s.a.map((v,i)=>v+s.u[i]*t+n[i]*rad);
        if(k%3===0)n=s.u.map(v=>v*(t?1:-1));
      }
      samples.push({id,n,p});
    }
  });
  let checks=0;
  for(const direction of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[1,2,3],[-2,1,-.5]]){
    const light=norm(direction),context=module.directionalShadowContext(scene,light,1e-6);
    for(const {id,n,p} of samples){
      const expected=dot(n,light)>0&&module.shadowBlocked(scene,p,n,light,1e-6);
      assert.equal(context.shadowed(id,n,p),expected,`shadow candidate loss for surface ${id}`);checks++;
    }
  }
  const {render,examples}=await import('./dist/molplotter.mjs');
  for(const lightAzimuth of [-.6,1.4])for(const shadowStrength of [.8,1]){
    const svg=render(examples.ethanol,{shadingMode:'halftone',lightAzimuth,castShadows:true,shadowStrength,shadingBrightness:.1,quality:'preview'});
    assert(svg.includes('<pattern'),'complex illumination retains pattern ink');
    assert(svg.includes('data-tone-method="analytic-local-shadows"'),'use directional per-surface path');
    assert(!/NaN|Infinity|<image\b|<filter\b/.test(svg),'finite vector output');
  }
  console.log(`Surface shadow checks passed: ${checks} ray comparisons and 4 renderer cases`);
})().catch(error=>{console.error(error);process.exitCode=1;});
