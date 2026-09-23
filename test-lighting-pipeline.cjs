'use strict';
// Physical direct light -> artistic lift/brightness/contrast -> quantized texture.
// Run after npm run build; no dependency on the user's private SVG file.
const assert=require('node:assert/strict');
const api=require('./renderer.js');

// Independent SVG clip membership evaluator: flatten cubic segments, then apply
// evenodd paths and nested clip unions. We inspect tone regions, not random ink.
function svgTree(svg){
 const root={tag:'root',a:{},children:[],parent:null},stack=[root],ids=new Map(),nodes=[];
 for(const m of svg.matchAll(/<\/?[A-Za-z][^>]*>/g)){
  const t=m[0];if(t.startsWith('</')){stack.pop();continue;}
  const tag=t.match(/^<([^\s/>]+)/)[1],a=Object.fromEntries([...t.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  const n={tag,a,children:[],parent:stack.at(-1)};n.parent.children.push(n);nodes.push(n);if(a.id)ids.set(a.id,n);if(!t.endsWith('/>'))stack.push(n);
 }
 const paths=new Map();
 function polygons(d){
  if(paths.has(d))return paths.get(d);
  const tokens=d.match(/[MLCQHVZmlcqhvz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[];
  let i=0,cmd='',p=[0,0],first=[0,0],line=[],out=[];
  const xy=()=>[+tokens[i++],+tokens[i++]];
  while(i<tokens.length){
   if(/^[A-Za-z]$/.test(tokens[i]))cmd=tokens[i++];
   if(cmd==='M'){if(line.length)out.push(line);p=xy();first=p;line=[p];cmd='L';}
   else if(cmd==='L'){p=xy();line.push(p);}
   else if(cmd==='H'){p=[+tokens[i++],p[1]];line.push(p);}
   else if(cmd==='V'){p=[p[0],+tokens[i++]];line.push(p);}
   else if(cmd==='C'){
    const a=p,b=xy(),c=xy(),q=xy();for(let k=1;k<=32;k++){const t=k/32,u=1-t;line.push([0,1].map(j=>u*u*u*a[j]+3*u*u*t*b[j]+3*u*t*t*c[j]+t*t*t*q[j]));}p=q;
   }else if(cmd==='Q'){
    const a=p,b=xy(),q=xy();for(let k=1;k<=32;k++){const t=k/32,u=1-t;line.push([0,1].map(j=>u*u*a[j]+2*u*t*b[j]+t*t*q[j]));}p=q;
   }else if(cmd==='Z'||cmd==='z'){if(line.length)out.push(line);line=[];p=first;cmd='';}
   else throw Error('Unexpected clip command '+cmd);
  }
  if(line.length)out.push(line);paths.set(d,out);return out;
 }
 function containsPath(d,x,y){let inside=false;for(const points of polygons(d))for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;}
 const reference=a=>a?.match(/^url\(#([^)]*)\)$/)?.[1];
 // Undo local->parent SVG transforms before testing template-local geometry.
 function local(n,x,y){
  for(const m of (n.a.transform||'').matchAll(/(translate|scale|rotate|matrix)\(([^)]*)\)/g)){
   const v=m[2].trim().split(/[ ,]+/).map(Number);
   if(m[1]==='translate'){x-=v[0];y-=v[1]||0;}
   else if(m[1]==='scale'){x/=v[0];y/=v[1]??v[0];}
   else if(m[1]==='rotate'){const a=v[0]*Math.PI/180,cx=v[1]||0,cy=v[2]||0,dx=x-cx,dy=y-cy;x=cx+dx*Math.cos(a)+dy*Math.sin(a);y=cy-dx*Math.sin(a)+dy*Math.cos(a);}
   else {const [a,b,c,d,e,f]=v,det=a*d-b*c,px=x-e,py=y-f;x=(d*px-c*py)/det;y=(-b*px+a*py)/det;}
  }
  return [x,y];
 }
 function target(n){const id=(n.a.href||n.a['xlink:href']||'').slice(1);assert(ids.has(id),'use target resolves: '+id);return ids.get(id);}
 function shape(n,x,y){
  [x,y]=local(n,x,y);const a=n.a;let inside;
  if(n.tag==='path')inside=containsPath(a.d||'',x,y);
  else if(n.tag==='circle')inside=(x-+a.cx)**2+(y-+a.cy)**2<=(+a.r)**2;
  else if(n.tag==='rect')inside=x>=+(a.x||0)&&y>=+(a.y||0)&&x<=+(a.x||0)+ +a.width&&y<=+(a.y||0)+ +a.height;
  else if(n.tag==='ellipse')inside=((x-+a.cx)/+a.rx)**2+((y-+a.cy)/+a.ry)**2<=1;
  else if(n.tag==='use')inside=shape(target(n),x-+(a.x||0),y-+(a.y||0));
  else inside=n.children.some(c=>shape(c,x,y));
  const ref=reference(a['clip-path']);return inside&&(!ref||shape(ids.get(ref),x,y));
 }
 return {levelAt(x,y){
  let value=0;
  function visit(n,x,y,depth=0){
   assert(depth<100,'acyclic SVG use references');
   if(['defs','clipPath','pattern'].includes(n.tag))return;
   [x,y]=local(n,x,y);const a=n.a,ref=reference(a['clip-path']);
   if(ref&&!shape(ids.get(ref),x,y))return;
   // Opaque front surfaces hide earlier painter layers, including their tones.
   if(a['data-role']==='surface-fill'&&shape({...n,a:{...a,transform:undefined}},x,y))value=0;
   if((n.tag==='g'||n.tag==='rect')&&(a['data-tone-level']||a['data-birth-level'])){
    if(n.tag!=='rect'||shape({...n,a:{...a,transform:undefined}},x,y))value=Math.max(value,+(a['data-tone-level']||a['data-birth-level']));
   }
   if(n.tag==='use'){visit(target(n),x-+(a.x||0),y-+(a.y||0),depth+1);return;}
   for(const child of n.children)visit(child,x,y,depth+1);
  }
  visit(root,x,y);return value;
 }};
}

// Regression for real template instancing, not just globally stored defs.
const instanced=svgTree(`<svg><defs><clipPath id="local"><circle cx="10" cy="10" r="8"/></clipPath><clipPath id="world"><rect x="100" y="200" width="10" height="20"/></clipPath><g id="tile" clip-path="url(#local)"><rect data-birth-level="3" x="0" y="0" width="20" height="20"/></g><g id="nested"><use href="#tile" transform="translate(2 3)"/></g></defs><g clip-path="url(#world)"><use href="#nested" transform="translate(100 200)"/></g><use href="#tile" x="300" y="400"/><g data-role="surface-layer"><circle data-role="surface-fill" cx="310" cy="410" r="2" fill="white"/></g></svg>`);
assert.equal(instanced.levelAt(10,10),0,'definitions alone do not paint');
assert.equal(instanced.levelAt(108,213),3,'nested use translations compose with local and world clips');
assert.equal(instanced.levelAt(113,213),0,'instance remains inside world clip');
assert.equal(instanced.levelAt(101,201),0,'instance remains inside template circle');
assert.equal(instanced.levelAt(305,410),3,'use x/y offsets are honored');
assert.equal(instanced.levelAt(310,410),0,'front opaque atom hides back template ink');

(async()=>{
 const {load}=await import('./scripts/load-painter.mjs');
 const {prepareScene,depthAt}=await load('scene.js'),{normalizeOptions}=await load('options.js');
 const {directLight,artisticLightSignal,directLimitForDarkness,facingLimitForDirect}=await load('lighting-transfer.js');
 const {createSurfaceAtlas}=await load('surface-atlas.js'),{build:buildBoundaries}=await load('boundaries.js');
 assert.equal(directLight(-.7),0);assert.equal(directLight(.8,.2),.8*.2);
 assert.equal(artisticLightSignal(0),0,'physical black is lifted only by downstream B=(signal+1)/2');
 assert.equal(artisticLightSignal(.2,.1),.4,'brightness is after shadow attenuation');
 assert.equal(facingLimitForDirect(0),0,'inclusive D=0 includes the back hemisphere');
 assert.equal(facingLimitForDirect(0,1,false),-Infinity,'strict D<0 is empty');
 assert.equal(facingLimitForDirect(0,0),Infinity,'fully blocked D=0 satisfies inclusive zero');
 assert.equal(facingLimitForDirect(0,0,false),-Infinity);
 assert.equal(facingLimitForDirect(-.01),-Infinity);
 for(const transmission of [0,.2,1])for(const inclusive of [false,true])for(const limit of [-.1,0,.1,.2,.5,1,1.1])for(const facing of [-1,-.1,0,.05,.2,.5,.9]){
  const direct=directLight(facing,transmission),cut=facingLimitForDirect(limit,transmission,inclusive);
  assert.equal(inclusive?facing<=cut:facing<cut,inclusive?direct<=limit:direct<limit,'physical inverse '+JSON.stringify({facing,transmission,limit,inclusive}));
 }
 // Reconstructed from the user's C60 SVG: scale60, atom multiplier .75,
 // yaw25°, pitch-15°. These two visible points straddle the light terminator.
 const opts={width:900,height:700,scale:60,atomRadiusScale:.75,yaw:25*Math.PI/180,pitch:-15*Math.PI/180,castShadows:true,shadowStrength:.8,quality:'export',shadingLevels:4,textureScale:.55};
 const o=normalizeOptions(opts),p=prepareScene(api.examples.c60,o),s=p.spheres[37];
 const xy=[[565,541.9142767477],[565,541.9342767477]],samples=xy.map(([x,y])=>{
  const wx=(x-450)/60,wy=(350-y)/60,point=[wx,wy,depthAt(s,wx,wy)],normal=point.map((v,k)=>(v-s.c[k])/s.r);
  return {point,normal,facing:normal.reduce((sum,v,k)=>sum+v*p.lightDirection[k],0)};
 });
 const expected=samples.map(h=>Math.max(0,h.facing)*(h.facing>0?.2:1));
 const actual=samples.map(h=>p.lightingFor(s)(h.normal,h.point));
 actual.forEach((v,i)=>assert(Math.abs(v-expected[i])<1e-12));
 assert(Math.abs(actual[0]-actual[1])<.0001,'0.02px no longer causes a .8 lighting jump');
 const litBack=p.unshadowedIllumination([-p.lightDirection[0],-p.lightDirection[1],-p.lightDirection[2]],s.c);assert.equal(litBack,0);
 const artChanged=prepareScene(api.examples.c60,normalizeOptions({...opts,shadingBrightness:-.4,shadingContrast:2.2,shadingLevels:64,textureScale:2}));
 samples.forEach((h,i)=>assert.equal(artChanged.lightingFor(artChanged.spheres[37])(h.normal,h.point),actual[i],'art controls cannot feed back into physical lighting'));
 for(const brightness of [-.4,0,.4])for(const exponent of [.5,1,2])for(const ink of [.125,.5,.875])for(const transmission of [0,.2,1])for(const facing of [-.8,0,.1,.6,.95]){
  const signal=artisticLightSignal(directLight(facing,transmission),brightness),darkness=((1-signal)/2)**exponent;
  const limit=facingLimitForDirect(directLimitForDarkness(ink,exponent,brightness),transmission);
  assert.equal(facing<=limit,darkness>=ink,'physical/artistic inverse agrees after brightness, contrast and full shadow');
 }
 // The accelerated shadow atlas must carry the same physical zero plateau.
 const boundaries=buildBoundaries(p.scene,depthAt,p.project,p.scale),regions=boundaries.dotRegions();assert(regions);
 const atlas=createSurfaceAtlas(p,regions,o),atlasLight=atlas.lightingFor(s);
 const atlasValues=samples.map(h=>atlasLight(h.normal,h.point));
 assert(Math.abs(atlasValues[0]-atlasValues[1])<.001,'atlas does not reintroduce ambient attenuation');
 const full=prepareScene(api.examples.c60,normalizeOptions({...opts,shadowStrength:1}));
 samples.forEach(h=>assert.equal(full.lightingFor(full.spheres[37])(h.normal,h.point),0));
 // All public quantized routes share the plateau, including actual emitted SVG
 // clip membership at the user's two points (rather than just metadata).
 let renders=0;
 for(const shadingMode of ['hatch','stipple','halftone'])for(const renderMode of ['precise','fast'])for(const shadingLevels of [4,16,64]){
  const options={...opts,quality:'preview',shadingMode,renderMode,quantizeShading:true,shadingLevels,castShadows:renderMode==='precise'};
  const svg=api.render(api.examples.c60,options);assert(!/NaN|Infinity|undefined/.test(svg));
  const tree=svgTree(svg),levels=xy.map(([x,y])=>tree.levelAt(x,y));
  assert(levels[0]>0&&levels[0]===levels[1],JSON.stringify({shadingMode,renderMode,shadingLevels,levels}));renders++;
 }
 // Brightness creates an EXACT zero threshold: choose a single back-lit sphere
 // and validate the inclusive quantization plateau plus full-shadow extreme.
 const sphere={atoms:[{element:'C',position:[0,0,0],radius:1}],bonds:[]};
 for(const N of [4,16,64]){
  const brightness=(1-2*((N/2-.5)/N))/2;
  assert.equal(directLimitForDarkness((N/2-.5)/N,1,brightness),0);
  for(const mode of ['precise','fast']){
   const svg=api.render(sphere,{width:220,height:220,scale:55,lightAzimuth:Math.PI,lightElevation:0,renderMode:mode,shadingMode:'hatch',shadingLevels:N,quantizeShading:true,shadingBrightness:brightness});
   const tree=svgTree(svg);assert.equal(tree.levelAt(110,110),N/2,'zero threshold includes physical-black face');
   assert.equal(tree.levelAt(95,115),N/2);
  }
 }
 for(const shadingMode of ['hatch','stipple','halftone'])for(const quantizeShading of [false,true]){
  const svg=api.render(api.examples.c60,{...opts,quality:'preview',shadingMode,quantizeShading,shadowStrength:1,shadingBrightness:.05});
  assert(!/NaN|Infinity|undefined/.test(svg));assert(svg.length>1000);
 }
 console.log(`PASS lighting pipeline: physical/artistic separation, exact zero and full shadow, C60 terminator continuity, atlas parity, ${renders} rendered mode/level clip checks`);
})().catch(error=>{console.error(error);process.exitCode=1;});
