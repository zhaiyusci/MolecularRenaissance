const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {historicalRenderer}=require('./test-fixtures/historical-renderer.cjs');
const {coverage}=require('./test-style-coverage.cjs');
(async()=>{
  const curves=await import('data:text/javascript;base64,'+readFileSync('build/ts/hatch-curves.js').toString('base64'));
  let checks=0;
  for(let i=0;i<80;i++){
    const k=Math.sin(i*.91),a=Math.cos(i*1.31),b=Math.sin(i*1.71),r=Math.hypot(a,b);
    for(const limit of [k-r,k+r,k,k+.32*r,k-.64*r]){
      const spans=curves.trigSpans(k,a,b,limit);
      for(let j=0;j<83;j++){
        const t=(j+.371)/83,value=k+a*Math.cos(t*2*Math.PI)+b*Math.sin(t*2*Math.PI);
        if(Math.abs(value-limit)<1e-10)continue;
        assert.equal(spans.some(([lo,hi])=>t>=lo&&t<=hi),value<limit,'analytic light intervals');checks++;
      }
    }
  }
  assert.deepEqual(curves.trigSpans(1,0,0,1),[]);
  assert.deepEqual(curves.trigSpans(1,0,0,2),[[0,1]]);
  assert.deepEqual(curves.intersectSpans([[0,.2],[.4,1]],[[.1,.5],[.8,.9]]),[[.1,.2],[.4,.5],[.8,.9]]);
  const curve=curves.projectedCircle(p=>[60*p[0],-60*p[1]],[0,0,0],[1,0,0],[0,.3,Math.sqrt(.91)]);
  for(const [lo,hi] of [[0,1],[.13,.67],[.86,1.21]]){
    const path=curve.path(lo,hi),tokens=path.match(/[MC]|-?\d+(?:\.\d+)?/g);
    assert.equal(tokens.shift(),'M');let p=[+tokens.shift(),+tokens.shift()];
    while(tokens.length){
      assert.equal(tokens.shift(),'C');const a=[+tokens.shift(),+tokens.shift()],b=[+tokens.shift(),+tokens.shift()],q=[+tokens.shift(),+tokens.shift()];
      for(let j=0;j<=20;j++){
        const t=j/20,u=1-t,v=[0,1].map(k=>u*u*u*p[k]+3*u*u*t*a[k]+3*u*t*t*b[k]+t*t*t*q[k]);
        assert(Math.abs(Math.hypot(v[0]/60,v[1]/18)-1)<.00002,'short cubic arcs stay on projected ellipse');
      }
      p=q;
    }
  }
  const current=await import('./dist/molplotter.mjs');
  // This is the legacy curve/ribbon optimization contract; the marks oracle
  // does not expand layered <use> instances or clipping definitions.
  const plain={quality:'preview',textureScale:1,hatchMode:'continuous'};
  const uniform=current.render(current.examples.sphere,{...plain,variableWidth:false});
  assert(/stroke-width="0.640" d="M[^"]*C/.test(uniform),'equal-width hatches emit ellipse curves, not sampled polylines');
  for(const options of [{lightAzimuth:1.4,lightElevation:-.3,castShadows:true},{shadingBrightness:.6},{shadingBrightness:-.6,shadingContrast:2.5},{castShadows:true,variableWidth:false}]){
    const svg=current.render(current.examples.ethanol,{...plain,...options});
    assert(!/NaN|Infinity/.test(svg)&&svg.includes('data-role="engraving"'),'finite hatch output under alternate illumination');
  }
  {
    const before=await historicalRenderer();
    const reports=[];
    for(const castShadows of [false,true]){
      const options={...plain,castShadows},a=before.render(before.examples.sphere,options),b=current.render(current.examples.sphere,options);
      // Both renderers explicitly use the current canvas-centered projection.
      const box=[400,300,500,400],mask=(x,y)=>(x-450)**2+(y-350)**2<45.4**2;
      const oldInk=coverage(a,box,mask),newInk=coverage(b,box,mask);
      assert(Math.abs(oldInk-newInk)<.02,'preserve mean hatch ink including tips');
      assert(b.length<a.length,'fewer serialized coordinates on a smooth sphere');
      reports.push({castShadows,oldInk,newInk,oldBytes:a.length,newBytes:b.length});
    }
    // The SVG encoding is now batched round subpaths. Unshadowed disk
    // geometry remains exact; sampled shadow-region error has its own tests.
    const {disks}=require('./test-shared-regions.cjs');
    for(const name of ['sphere','ethanol','c60']){
      // The historical engine predates tone quantization, so compare the continuous
      // stream; the quantized default has its own coverage parity in test-style-coverage.
      const options={...plain,shadingMode:'stipple',castShadows:false};
      assert.deepEqual(disks(current.render(current.examples[name],{...options,quantizeShading:false})),disks(before.render(before.examples[name],options)),`${name}: non-repeating disk coordinates and radii are identical`);
    }
    console.log('Hatch baseline comparison:',reports);
  }
  console.log(`Hatch geometry checks passed: ${checks} light classifications, cubic arcs, finite lighting, and pinned historical baseline comparisons`);
})().catch(error=>{console.error(error);process.exitCode=1;});
