'use strict';
// Layered hatching deliberately quantizes artistic width/darkness. It must not
// change scientific geometry or promote uncertified visibility to owner clips.
const assert=require('node:assert/strict');
const api=require('./renderer.js');

function parse(svg){
  const root={tag:'root',attrs:{},children:[],parent:null},stack=[root],nodes=[],ids=new Map();
  for(const match of svg.matchAll(/<\/?[\w:-]+\b[^>]*>/g)){
    const text=match[0];
    if(text.startsWith('</')){assert.equal(stack.pop().tag,text.match(/^<\/([\w:-]+)/)[1],'balanced SVG');continue;}
    const tag=text.match(/^<([\w:-]+)/)[1],attrs=Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
    const node={tag,attrs,children:[],parent:stack.at(-1)};node.parent.children.push(node);nodes.push(node);
    if(attrs.id){assert(!ids.has(attrs.id),'unique SVG IDs');ids.set(attrs.id,node);}
    if(!text.endsWith('/>'))stack.push(node);
  }
  assert.equal(stack.length,1,'closed SVG');
  for(const node of nodes)for(const [key,value] of Object.entries(node.attrs)){
    for(const ref of value.matchAll(/url\(#([^)]*)\)/g))assert(ids.has(ref[1]),'resolved URL reference '+ref[1]);
    if(key==='href'&&value.startsWith('#'))assert(ids.has(value.slice(1)),'resolved use reference');
    if(key==='aria-labelledby')for(const id of value.split(/\s+/))assert(ids.has(id),'resolved title reference');
  }
  return {root,nodes,ids};
}
function ancestors(node){const list=[];for(let p=node.parent;p;p=p.parent)list.push(p);return list;}
const clipId=node=>node.attrs['clip-path']?.match(/^url\(#([^)]*)\)$/)?.[1];
const clipPath=(tree,id)=>{const clip=tree.ids.get(id);assert.equal(clip?.tag,'clipPath');assert.equal(clip.children.length,1);assert.equal(clip.children[0].tag,'path');assert.equal(clip.children[0].attrs['clip-rule'],'evenodd','bands and shadow complements require actual SVG evenodd clipping');return clip.children[0].attrs.d;};

// Independent SVG M/L/H/V/C/Q polygonization and evenodd membership. No production
// region parser or tone function is used as the membership oracle.
function polygons(path){
  const tokens=path.match(/[MLHVCQZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)||[];
  const loops=[];let i=0,p=null,loop=null;
  const point=()=>[+tokens[i++],+tokens[i++]];
  while(i<tokens.length){const command=tokens[i++];
    if(command==='M'){p=point();loop=[p];loops.push(loop);}
    else if(command==='L'){p=point();loop.push(p);}
    else if(command==='H'){p=[+tokens[i++],p[1]];loop.push(p);}
    else if(command==='V'){p=[p[0],+tokens[i++]];loop.push(p);}
    else if(command==='C'){
      const a=p,b=point(),c=point(),d=point();
      for(let k=1;k<=24;k++){const t=k/24,u=1-t;loop.push([u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]);}p=d;
    }else if(command==='Q'){
      const a=p,b=point(),c=point();for(let k=1;k<=24;k++){const t=k/24,u=1-t;loop.push([u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]]);}p=c;
    }else if(command==='Z'){p=loop[0];}
    else assert.fail('Unsupported path command '+command);
  }
  return loops;
}
function contains(loops,x,y){let inside=false;for(const loop of loops)for(let i=0,j=loop.length-1;i<loop.length;j=i++){
  const a=loop[j],b=loop[i];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
}return inside;}

(async()=>{
  const {load}=await import('./scripts/load-painter.mjs');
  const {normalizeOptions}=await load('options.js');
  const {prepareScene,depthAt}=await load('scene.js');
  const {build}=await load('boundaries.js');
  const {buildLayeredHatching}=await load('layered-hatching.js');
  const base={width:320,height:280,scale:26,quality:'preview',shadingMode:'hatch'};
  const dataBefore=structuredClone(api.examples);
  let presets=0,active=0,fallback=0,ownerClips=0,toneChecks=0;
  function certified(model,options){
    const o=normalizeOptions(options),p=prepareScene(model,o),b=build(p.scene,depthAt,p.project,p.scale);
    return {o,p,paths:b&&b.validate(api.elementColor)?b.surfacePaths(false):null};
  }
  function validateLayered(svg,paths){
    assert(!/NaN|Infinity/.test(svg));const tree=parse(svg);
    const skeletons=tree.nodes.filter(n=>n.tag==='path'&&n.attrs.id&&n.parent.tag==='defs'&&n.parent.attrs['data-hatch-renderer']==='layered');
    const uses=tree.nodes.filter(n=>n.tag==='use'&&n.attrs.href?.startsWith('#lh-'));
    const defs=tree.nodes.find(n=>n.tag==='defs'&&n.attrs['data-hatch-renderer']==='layered');
    if(defs){assert.equal(+defs.attrs['data-skeleton-paths'],skeletons.length);assert.equal(+defs.attrs['data-tone-levels'],16);
      assert.equal(+defs.attrs['data-tone-layers'],tree.nodes.filter(n=>n.attrs['data-tone-level']).length);}
    for(const node of tree.nodes.filter(n=>n.tag==='clipPath'&&/-s\d+-owner$/.test(n.attrs.id||''))){
      const id=+node.attrs.id.match(/-s(\d+)-owner$/)[1];assert.equal(clipPath(tree,node.attrs.id),paths[id],'owner path equals independent certified boundary path');ownerClips++;
    }
    for(const use of uses){
      const target=tree.ids.get(use.attrs.href.slice(1));assert.equal(target.tag,'path');assert.equal(target.attrs.fill,'none');
      const owner=ancestors(use).find(n=>n.attrs['data-hatch-renderer']==='layered');
      assert(owner,'FULL stroked use must be inside the owner clip group');assert.match(clipId(owner),/-s\d+-owner$/);
      assert.equal(owner.attrs.transform,undefined,'owner clips remain in world SVG coordinates');
      for(const parent of ancestors(use).filter(n=>n.attrs['data-tone-level']))assert.equal(parent.attrs.transform,undefined,'tone clips are not translated with local templates');
      assert.equal(owner.attrs.fill,'none');assert.equal(owner.attrs.stroke,'#161616');assert(+use.attrs['stroke-width']>0);
      const level=ancestors(use).find(n=>n.attrs['data-tone-level']);assert(level);assert(+level.attrs['data-tone-level']>=1&&+level.attrs['data-tone-level']<=16);
    }
    return {tree,skeletons,uses,defs};
  }
  for(const renderMode of ['precise','fast'])for(const shadingMode of ['hatch','stipple','halftone']){
    const opts={...base,renderMode,shadingMode},expected=renderMode==='fast'?'continuous':'layered';
    assert.equal(api.render(api.examples.sphere,opts),api.render(api.examples.sphere,{...opts,hatchMode:expected}),'mode-aware default');
    assert.equal(api.render(api.examples.sphere,{...opts,hatchMode:undefined}),api.render(api.examples.sphere,opts),'undefined uses mode-aware default');
  }
  for(const hatchMode of ['bogus','',null,true,1])assert.throws(()=>api.render(api.examples.sphere,{...base,hatchMode}),/Invalid hatchMode/);
  assert.throws(()=>api.render(api.examples.sphere,{...base,renderMode:'fast',hatchMode:'layered'}),/Layered hatching requires precise rendering/);
  for(const [name,model] of Object.entries(api.examples)){
    const opts={...base,hatchMode:'layered'},f=certified(model,opts),svg=api.render(model,opts);
    assert.equal(api.render(model,opts),svg,'deterministic '+name);
    assert.equal(api.render(model,base),svg,'default is layered for '+name);
    assert.equal(api.render(model,{...base,hatchMode:undefined}),svg,'undefined precise default for '+name);
    const continuous=api.render(model,{...base,hatchMode:'continuous'});
    assert(!continuous.includes('data-hatch-mode='),'explicit continuous keeps old route '+name);
    const fast={...base,renderMode:'fast'};
    assert.equal(api.render(model,fast),api.render(model,{...fast,hatchMode:'continuous'}),'fast default remains available '+name);
    assert.equal(api.render(model,{...fast,hatchMode:undefined}),api.render(model,fast),'undefined fast default '+name);
    presets++;
    if(f.paths){assert.match(svg,/data-hatch-mode="layered"/);validateLayered(svg,f.paths);active++;}
    else{assert.match(svg,/data-hatch-mode="continuous-fallback"/);assert.match(svg,/data-hatch-fallback="uncertified-visible-regions"/);assert(!svg.includes('<use href="#lh-'));fallback++;}
  }
  assert.equal(presets,17);assert(active>0);
  const nested={atoms:[{element:'C',position:[0,0,0],radius:1.2},{element:'O',position:[.1,0,0],radius:.3}],bonds:[]};
  const nestedSvg=api.render(nested,{...base,hatchMode:'layered'});
  assert.match(nestedSvg,/data-hatch-mode="continuous-fallback"/);
  assert.equal(nestedSvg.replace(/ data-hatch-mode="continuous-fallback"/,'').replace(/ data-hatch-fallback="uncertified-visible-regions"/,''),api.render(nested,{...base,hatchMode:'continuous'}),'uncertified fallback actually uses continuous rendering');

  const sphere=api.examples.sphere;
  function direct(overrides={}){const f=certified(sphere,{...base,hatchMode:'layered',...overrides});assert(f.paths);const result=buildLayeredHatching(f.p,f.o,f.paths);return {...f,result,svg:result.defs+[...result.bySurface.values()].join('')};}
  const ordinary=direct({shadingBrightness:-.2}),reused=validateLayered(ordinary.svg,ordinary.paths);
  assert(reused.uses.length>reused.skeletons.length*2,'several levels actually reuse each small skeleton family');
  assert.equal(direct({crossHatch:false}).result.skeletonPaths,2);assert.equal(direct({crossHatch:true}).result.skeletonPaths,3);
  const widths={};for(const use of reused.uses)(widths[use.attrs.href]??=new Set()).add(use.attrs['stroke-width']);
  assert(Object.values(widths).some(s=>s.size>1),'variable width changes level widths');
  // Equal-radius spheres share actual definition nodes, not copied path strings.
  const equalPair={atoms:[{element:'C',position:[-1.2,0,0]},{element:'C',position:[1.2,0,0]}],bonds:[]};
  const pairOptions={...base,hatchMode:'layered',shadingBrightness:-.2},pairScene=certified(equalPair,pairOptions);
  const pairSvg=validateLayered(api.render(equalPair,pairOptions),pairScene.paths);
  assert.equal(pairSvg.skeletons.length,3,'two equal spheres share three family definitions');
  const pairOwners=new Map();for(const use of pairSvg.uses){const owner=ancestors(use).find(n=>n.attrs['data-hatch-renderer']==='layered');
    const sourceId=+clipId(owner).match(/-s(\d+)-owner$/)[1];const refs=pairOwners.get(sourceId)||new Set();refs.add(use.attrs.href);pairOwners.set(sourceId,refs);
    const translation=use.attrs.transform?.match(/^translate\(([-+\d.e]+)[ ,]+([-+\d.e]+)\)$/i);assert(translation,'sphere template is translated at use only');
    const center=pairScene.p.project(pairScene.p.scene[sourceId].c);assert(Math.abs(+translation[1]-center[0])<.00011&&Math.abs(+translation[2]-center[1])<.00011,'template follows exact projected sphere center');
  }
  assert.equal(pairOwners.size,2);assert.deepStrictEqual([...pairOwners.get(0)].sort(),[...pairOwners.get(1)].sort(),'both owners reference the same definitions');
  const c60=certified(api.examples.c60,pairOptions),c60Svg=validateLayered(api.render(api.examples.c60,pairOptions),c60.paths);
  assert.equal(c60Svg.skeletons.length,3,'C60 reuses the three carbon-sphere family definitions');
  const fixed=direct({variableWidth:false}),fixedUses=validateLayered(fixed.svg,fixed.paths).uses,fixedWidths={};
  for(const use of fixedUses)(fixedWidths[use.attrs.href]??=new Set()).add(use.attrs['stroke-width']);
  assert(Object.values(fixedWidths).every(s=>s.size===1),'fixed width remains fixed across all levels');
  for(const o of [{hatchWidth:0},{lineWidth:0},{shadingSize:0},{shadingMode:'stipple'},{shadingMode:'halftone'}]){
    const f=direct(o);assert.equal(f.result.defs,'');assert.equal(f.result.bySurface.size,0);assert.equal(f.result.skeletonPaths,0);
    if(!o.shadingMode)assert(!api.render(sphere,{...base,hatchMode:'layered',...o}).includes('<use href="#lh-'));
  }
  assert.equal(validateLayered(direct({shadingBrightness:1}).svg,direct({shadingBrightness:1}).paths).uses.length,0);
  const darkest=direct({shadingBrightness:-1});
  assert.equal(darkest.result.toneLayers,1,'fully dark surfaces paint only the highest disjoint band');
  assert.equal(parse(darkest.svg).nodes.find(n=>n.attrs['data-tone-level'])?.attrs['data-tone-level'],'16');

  // Geometry is unaffected by changing only hatching strategy.
  for(const angles of [[0,0],[.7,-.45],[1.4,.8]])for(const style of [{},{crossHatch:false,variableWidth:false},{labels:true,elementTextures:true,colorWash:true}]){
    const options={...base,yaw:angles[0],pitch:angles[1],...style};
    const c=prepareScene(api.examples.ethanol,normalizeOptions(options)),l=certified(api.examples.ethanol,{...options,hatchMode:'layered'});
    assert.deepStrictEqual(l.p.scene,c.scene);for(const s of c.spheres)assert.deepStrictEqual(l.p.project(s.c),c.project(s.c));
    const svg=api.render(api.examples.ethanol,{...options,hatchMode:'layered'});assert(l.paths);validateLayered(svg,l.paths);
  }
  // Tone membership uses an independent physical dot product and forward gamma,
  // not the builder's inverse-threshold formula or production path parser.
  function checkTones(f,shadowStrength=null){
    const tree=parse(f.svg),s=f.p.spheres[0],center=f.p.project(s.c),r=s.r*f.p.scale,L=f.p.lightDirection;
    const groups=tree.nodes.filter(n=>n.attrs['data-tone-level']&&((shadowStrength!==null)===ancestors(n).some(a=>a.attrs['data-hatch-shadow']==='true')));
    const byLevel=new Map(groups.map(g=>[+g.attrs['data-tone-level'],polygons(clipPath(tree,clipId(g)))]));
    for(let ix=-4;ix<=4;ix++)for(let iy=-4;iy<=4;iy++){
      const x=ix*.17,y=iy*.17;if(x*x+y*y>.7)continue;
      const n=[x,-y,Math.sqrt(1-x*x-y*y)];let lit=n.reduce((a,v,i)=>a+v*L[i],0);
      if(shadowStrength!==null)lit=(Math.max(-1,Math.min(1,lit))+1)*(1-shadowStrength)-1;
      const darkness=((1-Math.max(-1,Math.min(1,lit+2*f.o.shadingBrightness)))/2)**(f.o.shadingContrast/1.2);
      const farFromBands=Array.from({length:16},(_,i)=>(i+.5)/16).every(t=>Math.abs(darkness-t)>=.006);
      let memberships=0;
      for(let level=1;level<=16;level++){
        const lower=(level-.5)/16,upper=level===16?Infinity:(level+.5)/16;
        const loops=byLevel.get(level),actual=loops?contains(loops,center[0]+x*r,center[1]+y*r):false;
        if(actual)memberships++;
        if(Math.abs(darkness-lower)<.006||Math.abs(darkness-upper)<.006)continue;
        // A band can be absent if all three family gates are closed. Interior
        // points sufficiently dark for level 4+ pass at least one family gate.
        if(level<4&&!loops)continue;
        assert.equal(actual,darkness>=lower&&darkness<upper,`disjoint band inversion level=${level} brightness=${f.o.shadingBrightness} contrast=${f.o.shadingContrast} shadow=${shadowStrength}`);toneChecks++;
      }
      if(farFromBands)assert(memberships<=1,'disjoint bands must not repeatedly paint antialiased strokes at the same point');
    }
  }
  for(const shadingBrightness of [-.35,0,.35])for(const shadingContrast of [.6,1.2,2])checkTones(direct({shadingBrightness,shadingContrast,lightAzimuth:.6,lightElevation:.3}));
  for(const strength of [.4,1])for(const shadingBrightness of [0,.3]){
    const f=certified(sphere,{...base,hatchMode:'layered',castShadows:true,shadowStrength:strength,shadingBrightness,lightAzimuth:0,lightElevation:0});
    // A controlled full-front shadow isolates attenuation inversion. Supplied
    // owner paths still come from the actual certified independent arrangement.
    const context=f.p.directionalShadows();f.p.mayShadow=()=>true;f.p.directionalShadows=()=>({...context,shadowed:()=>true});
    const result=buildLayeredHatching(f.p,f.o,f.paths),v={...f,result,svg:result.defs+[...result.bySurface.values()].join('')};
    assert.equal(result.stats.shadowBuilds,1);assert(result.stats.shadowSamples>0);assert(v.svg.includes('data-hatch-shadow="true"'));
    const parsed=validateLayered(v.svg,f.paths).tree,shadowGroup=parsed.nodes.find(n=>n.attrs['data-hatch-shadow']==='true');
    const owner=ancestors(shadowGroup).find(n=>n.attrs['data-hatch-renderer']==='layered');
    const litGroup=owner.children.find(n=>clipId(n)?.endsWith('-unshadowed'));assert(litGroup,'unshadowed strokes have an explicit complementary clip');
    const darkMask=polygons(clipPath(parsed,clipId(shadowGroup))),litMask=polygons(clipPath(parsed,clipId(litGroup)));
    for(let x=0;x<7;x++)for(let y=0;y<7;y++){
      const px=(x+.37)/7*f.o.width,py=(y+.23)/7*f.o.height;
      assert.notEqual(contains(darkMask,px,py),contains(litMask,px,py),'shadow and unshadowed masks partition viewport without overpainting');
    }
    checkTones(v,strength);
  }
  for(const shadowStrength of [.4,1]){
    const o={...base,hatchMode:'layered',castShadows:true,shadowStrength,lightAzimuth:.8,lightElevation:.4},f=certified(api.examples.ethanol,o);
    const svg=api.render(api.examples.ethanol,o);assert.equal(svg,api.render(api.examples.ethanol,o));validateLayered(svg,f.paths);
  }
  // With a limb-reaching skeleton and deliberately wide strokes, centerline
  // clipping alone would leak. Assert the actual SVG keeps the whole <use>
  // under the certified owner clip, rather than attaching a clip to defs only.
  const wide=direct({hatchWidth:6,shadingBrightness:-1}),w=validateLayered(wide.svg,wide.paths),s=wide.p.spheres[0],center=wide.p.project(s.c),r=s.r*wide.p.scale;
  let outsideCandidates=0;const ownerPolygon=polygons(wide.paths[0]);
  for(const use of w.uses){const path=w.tree.ids.get(use.attrs.href.slice(1)),tr=use.attrs.transform?.match(/^translate\(([-+\d.e]+)[ ,]+([-+\d.e]+)\)$/i);const shift=tr?[+tr[1],+tr[2]]:[0,0];
    for(const loop of polygons(path.attrs.d))for(const p of [loop[0],loop.at(-1)]){
      const dx=p[0]+shift[0]-center[0],dy=p[1]+shift[1]-center[1],length=Math.hypot(dx,dy),half=(+use.attrs['stroke-width'])/2;
      if(length&&length+half>r+.02){
        // Round-cap footprint outside the owner must be clipped, even though
        // its centerline endpoint itself is on/inside the certified sphere.
        const q=[center[0]+dx*(length+half*.9)/length,center[1]+dy*(length+half*.9)/length];
        if(!contains(ownerPolygon,...q))outsideCandidates++;
      }
    }
  }
  assert(outsideCandidates>0,'exercise strokes with potential footprint outside the sphere, not center-only geometry');
  assert.deepStrictEqual(api.examples,dataBefore,'all source atom coordinates and bonds remain immutable');
  assert(toneChecks>1000);
  console.log(`PASS layered hatching: ${presets} deterministic presets (${active} active/${fallback} fallback), ${ownerClips} exact owner clips, ${toneChecks} independent tone/inversion probes; reuse, full-stroke clipping, styles, shadows, types/defaults`);
})().catch(error=>{console.error(error);process.exitCode=1;});
