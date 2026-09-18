/* Dependency-free orthographic line engraving. Browser + Node.js. */
(function (root) {
  'use strict';
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(a,s)=>a.map(v=>v*s);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=a=>mul(a,1/Math.hypot(...a));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const atom=(element,x,y,z)=>({element,position:[x,y,z]});
  const examples={
    sphere:{name:'单球 · 明暗研究',atoms:[atom('C',0,0,0)],bonds:[]},
    pair:{name:'双球 · 遮挡研究',atoms:[atom('C',-.85,-.25,-.3),atom('O',.85,.25,.3)],bonds:[[0,1]]},
    water:{name:'水 · H₂O',atoms:[atom('O',0,.25,0),atom('H',-.78,-.35,.1),atom('H',.78,-.35,.1)],bonds:[[0,1],[0,2]]},
    ethanol:{name:'乙醇 · C₂H₆O',atoms:[atom('C',-1.22,0,0),atom('C',.12,.55,0),atom('O',1.28,-.2,.15),atom('H',2.02,.28,.15),atom('H',-1.3,-.72,.8),atom('H',-1.95,.75,.1),atom('H',-1.38,-.5,-.92),atom('H',.2,1.2,.88),atom('H',.22,1.14,-.92)],bonds:[[0,1],[1,2],[2,3],[0,4],[0,5],[0,6],[1,7],[1,8]]}
  };
  function rotate(p,yaw,pitch){
    const x=p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),z=-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw);
    return [x,p[1]*Math.cos(pitch)-z*Math.sin(pitch),p[1]*Math.sin(pitch)+z*Math.cos(pitch)];
  }
  // Frontmost intersection of an orthographic camera ray with closed primitives.
  function depthAt(s,x,y){
    if(s.kind==='sphere'){
      const d=s.r*s.r-(x-s.c[0])**2-(y-s.c[1])**2;
      return d < -1e-10 ? -Infinity : s.c[2]+Math.sqrt(Math.max(0,d));
    }
    const w=[x-s.a[0],y-s.a[1],-s.a[2]],u=s.u;
    const wu=dot(w,u),A=1-u[2]*u[2],B=2*(w[2]-wu*u[2]),C=dot(w,w)-wu*wu-s.r*s.r;
    let best=-Infinity;
    if(A>1e-12){
      const disc=B*B-4*A*C;
      if(disc>=-1e-10){
        const q=Math.sqrt(Math.max(0,disc));
        for(const z of [(-B-q)/(2*A),(-B+q)/(2*A)]){
          const t=wu+z*u[2];
          if(t>=-1e-8&&t<=s.length+1e-8) best=Math.max(best,z);
        }
      }
    }
    if(Math.abs(u[2])>1e-12){
      for(const t of [0,s.length]){
        const z=(t-wu)/u[2],v=sub(add(w,[0,0,z]),mul(u,t));
        if(dot(v,v)<=s.r*s.r+1e-10) best=Math.max(best,z);
      }
    }
    return best;
  }
  // Smooth width law: bright marks thin, shadow marks broad. Surface illumination
  // is signed cosine in [-1,1]; retain tonal differentiation in the dark hemisphere.
  function engravingWidth(base,illumination){
    const darkness=(1-Math.max(-1,Math.min(1,illumination)))/2;
    return base*(.4+1.15*darkness);
  }
  const elementPalette=Object.freeze({C:'#ded8cf',H:'#ffffff',O:'#eab5ac',N:'#b8ccdf',S:'#ead99e',P:'#ebc39f'});
  const elementInkPalette=Object.freeze({C:'#79451d',H:'#555555',O:'#972b25',N:'#245889',S:'#886219',P:'#a24b21'});
  function elementColor(element,strength=.65,saturation=1){return mixColor(Object.hasOwn(elementPalette,element)?elementPalette[element]:'#ded8cf',strength,saturation);}
  function elementInkColor(element,strength=.65,saturation=1){return mixColor(Object.hasOwn(elementInkPalette,element)?elementInkPalette[element]:'#555555',strength,saturation);}
  function mixColor(hex,strength,saturation){
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
    const max=Math.max(...rgb),min=Math.min(...rgb),lightness=(max+min)/2,chroma=max-min;
    const capacity=1-Math.abs(2*lightness-1);
    // Scale HSL saturation while retaining hue/lightness. Then mix with white.
    const factor=chroma>0?Math.min(capacity,chroma*saturation)/chroma:1;
    return '#'+rgb.map(v=>Math.round(255*(1+((lightness+(v-lightness)*factor)-1)*strength)).toString(16).padStart(2,'0')).join('');
  }
  function render(molecule,options={}){
    const o={width:900,height:700,yaw:.25,pitch:-.16,lightAzimuth:-29*Math.PI/180,lightElevation:32*Math.PI/180,lightType:'directional',lightDistance:3,density:24,lineWidth:.8,variableWidth:true,optimizePaths:true,shadingMode:'hatch',shadingContrast:1.2,dotSpacing:5,dotSize:1,dotContrast:1.2,crossHatch:true,colorWash:false,colorMode:'wash',washStrength:.65,colorSaturation:1,washOffsetX:0,washOffsetY:0,labelMatchFill:false,labels:false,labelSize:17,labelStrokeWidth:4,labelStrokeColor:'#ffffff',labelColor:'#161616',labelFont:"Georgia, 'Times New Roman', serif",labelBold:false,labelItalic:true,...options};
    o.outlineWidth=options.outlineWidth===undefined?o.lineWidth:options.outlineWidth;
    o.hatchWidth=options.hatchWidth===undefined?o.lineWidth:options.hatchWidth;
    // Shared controls override their legacy equivalents only when supplied.
    // Keep legacy API calls/default artwork intact; the UI uses only these three.
    for(const [key,min,max] of [['shadingDensity',.4,2.5],['shadingSize',0,1.5],['shadingContrast',.5,2.5]]){
      if(options[key]!==undefined&&(!Number.isFinite(options[key])||options[key]<min||options[key]>max))throw new Error('Invalid option: '+key);
    }
    if(options.shadingDensity!==undefined){o.density=Math.round(24*o.shadingDensity);o.dotSpacing=5/o.shadingDensity;}
    if(options.shadingSize!==undefined){o.hatchWidth=.8*o.shadingSize;o.dotSize=o.shadingSize;}
    o.shadingContrast=options.shadingContrast===undefined?1.2:options.shadingContrast;
    if(options.shadingContrast!==undefined)o.dotContrast=o.shadingContrast;
    for(const k of ['dotSpacing','dotSize','dotContrast','outlineWidth','hatchWidth','colorSaturation','washOffsetX','washOffsetY','width','height','yaw','pitch','lightAzimuth','lightElevation','lightDistance','density','lineWidth','labelSize','labelStrokeWidth','washStrength']) if(!Number.isFinite(o[k])) throw new Error('Invalid option: '+k);
    if(!['wash','ink'].includes(o.colorMode))throw new Error('Invalid colorMode');
    if(!['hatch','stipple','halftone'].includes(o.shadingMode)) throw new Error('Invalid shadingMode');
    if(o.dotSpacing<2||o.dotSpacing>14||o.dotSize<0||o.dotSize>1.5||o.dotContrast<.5||o.dotContrast>2.5) throw new Error('Invalid dot settings');
    if(o.width<200||o.height<200||o.lineWidth<0||o.outlineWidth<0||o.hatchWidth<0) throw new Error('Invalid output dimensions or line width');
    if(o.colorSaturation<0||o.colorSaturation>4) throw new Error('colorSaturation must be between 0 and 4');
    if(Math.abs(o.washOffsetX)>20||Math.abs(o.washOffsetY)>20) throw new Error('Wash offsets must be between -20 and 20');
    if(o.washStrength<0||o.washStrength>1) throw new Error('washStrength must be between 0 and 1');
    if(o.labelSize<6||o.labelSize>96||o.labelStrokeWidth<0||o.labelStrokeWidth>16) throw new Error('Invalid label size or stroke width');
    for(const key of ['labelColor','labelStrokeColor']) if(typeof o[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(o[key])) throw new Error('Invalid label color: '+key);
    if(typeof o.labelFont!=='string'||!o.labelFont.trim()||o.labelFont.length>200) throw new Error('Invalid label font');
    if(!['directional','point'].includes(o.lightType)) throw new Error('Invalid lightType');
    if(o.lightDistance<1.2) throw new Error('lightDistance must be at least 1.2 scene radii');
    o.density=Math.round(Math.max(8,Math.min(60,o.density)));
    if(!molecule||!Array.isArray(molecule.atoms)||!molecule.atoms.length||!Array.isArray(molecule.bonds)) throw new Error('Expected atoms and bonds');
    for(const a of molecule.atoms) if(!Array.isArray(a.position)||a.position.length!==3||!a.position.every(Number.isFinite)) throw new Error('Invalid atom position');
    const center=mul(molecule.atoms.reduce((s,a)=>add(s,a.position),[0,0,0]),1/molecule.atoms.length);
    const radii={H:.27,C:.48,N:.46,O:.44,S:.55,P:.55};
    const spheres=molecule.atoms.map(a=>({kind:'sphere',c:rotate(sub(a.position,center),o.yaw,o.pitch),r:radii[a.element]||.48,element:a.element}));
    const cylinders=molecule.bonds.map(b=>{
      if(!Array.isArray(b)||b.length!==2||!b.every(i=>Number.isInteger(i)&&spheres[i])) throw new Error('Invalid bond');
      const a=spheres[b[0]].c,end=spheres[b[1]].c,v=sub(end,a),length=Math.hypot(...v);
      if(length<1e-8) throw new Error('Zero length bond');
      return {kind:'cylinder',a,u:mul(v,1/length),length,r:.115};
    });
    const scene=[...spheres,...cylinders];
    const lo=[0,1].map(i=>Math.min(...spheres.map(s=>s.c[i]-s.r))),hi=[0,1].map(i=>Math.max(...spheres.map(s=>s.c[i]+s.r)));
    const scale=Math.min((o.width-150)/(hi[0]-lo[0]),(o.height-190)/(hi[1]-lo[1]),210);
    const cx=(lo[0]+hi[0])/2,cy=(lo[1]+hi[1])/2;
    const project=p=>[(p[0]-cx)*scale+o.width/2,o.height/2-12-(p[1]-cy)*scale];
    // Directional light in camera space: azimuth 0 = front, +PI/2 = right.
    // Positive elevation points upward; independent of molecule rotation.
    const light=[Math.sin(o.lightAzimuth)*Math.cos(o.lightElevation),Math.sin(o.lightElevation),Math.cos(o.lightAzimuth)*Math.cos(o.lightElevation)];
    // A finite source outside the bounding sphere. Distance changes incidence at
    // each surface point, not just a global brightness multiplier. No falloff.
    const sceneRadius=Math.max(...spheres.map(s=>Math.hypot(...s.c)+s.r));
    const lightPosition=mul(light,o.lightDistance*sceneRadius);
    const illumination=(n,p)=>dot(n,o.lightType==='point'?norm(sub(lightPosition,p)):light);
    const paths=[],inkPaths=[];
    const coloredTexture=o.colorWash&&o.colorMode==='ink';
    const inkFor=element=>elementInkColor(element,o.washStrength,o.colorSaturation);
    const fitter=o.optimizePaths?(typeof module!=='undefined'&&module.exports?require('./wash.js'):root.MolWash):null;
    if(o.optimizePaths&&(!fitter||typeof fitter.fitContour!=='function')) throw new Error('Load updated wash.js before renderer.js');
    const coord=p=>p.map(v=>String(Number(v.toFixed(3)))).join(' ');
    function compactPath(points,tolerance=.015){
      const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
      // Genuine straight visible runs need only their two original endpoints.
      if(length2>1e-12&&points.every(p=>{
        const t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length2;
        return t>=-1e-9&&t<=1+1e-9&&Math.abs(dx*(p[1]-a[1])-dy*(p[0]-a[0]))<=1e-6*Math.sqrt(length2);
      }))return 'M'+coord(a)+'L'+coord(b);
      let curves;
      if(length2<1e-10&&points.length>3){
        // Fit complete circles/loops as open halves, keeping their original seam.
        let far=1,distance=-1;
        for(let i=1;i<points.length-1;i++){
          const d=(points[i][0]-a[0])**2+(points[i][1]-a[1])**2;
          if(d>distance){distance=d;far=i;}
        }
        curves=fitter.fitContour(points.slice(0,far+1),tolerance).concat(fitter.fitContour(points.slice(far),tolerance));
      }else curves=fitter.fitContour(points,tolerance);
      return 'M'+coord(a)+curves.map(c=>c.length===2?'L'+coord(c[1]):'C'+c.slice(1).map(coord).join(' ')).join('');
    }
    const visible=p=>scene.every(s=>depthAt(s,p[0],p[1])<=p[2]+.00015);
    // Visibility is tested against EVERY sphere/cylinder, not center-depth sorting.
    // Fine sampling bounds transition error to ~one screen pixel at default size.
    function curve(fn,steps,width,accept=()=>true,engrave=false,closed=false,element=null){
      const target=coloredTexture&&engrave?inkPaths:paths;
      const ink=coloredTexture&&engrave?inkFor(element):'#161616';
      if(width===0||(engrave&&o.shadingMode!=='hatch'))return; // No zero-width marks or hatching in dot modes.
      let run=[];
      const runs=[];
      const flush=()=>{if(run.length>1)runs.push(run);run=[];};
      for(let i=0;i<=steps;i++){
        const {p,n}=fn(i/steps);
        let lit=illumination(n,p);
        if(engrave&&o.shadingContrast!==1.2){
          // Same contrast direction as dot tones: emphasize deep shade while
          // clearing lighter marks. Applies to both hatching masks and width.
          const darkness=(1-Math.max(-1,Math.min(1,lit)))/2;
          lit=1-2*Math.pow(darkness,o.shadingContrast/1.2);
        }
        if(accept(n,p,lit)&&visible(p))run.push({xy:project(p),lit,index:i});else flush();
      }
      flush();
      // Join visible runs spanning the periodic parameter seam: no false tips.
      if(closed&&runs.length>1&&runs[0][0].index===0&&runs.at(-1).at(-1).index===steps){
        const last=runs.pop();runs[0]=last.concat(runs[0].slice(1));
      }
      for(const points of runs){
        if(!engrave||!o.variableWidth){
          const d=o.optimizePaths?compactPath(points.map(q=>q.xy)):points.map(({xy:p},i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join('');
          target.push(`<path${coloredTexture&&engrave?' stroke="'+ink+'"':''} stroke-width="${width.toFixed(3)}" d="${d}"/>`);
          continue;
        }
        // A continuous filled ribbon, not many overlapping constant-width strokes.
        // All widths are in output viewBox units; no random perturbation.
        const clean=points.filter((q,i)=>i===0||Math.hypot(q.xy[0]-points[i-1].xy[0],q.xy[1]-points[i-1].xy[1])>1e-6);
        if(clean.length<2)continue;
        const loop=closed&&clean[0].index===0&&clean.at(-1).index===steps;
        const distances=[0];
        for(let i=1;i<clean.length;i++)distances.push(distances[i-1]+Math.hypot(clean[i].xy[0]-clean[i-1].xy[0],clean[i].xy[1]-clean[i-1].xy[1]));
        const total=distances.at(-1),tipLength=Math.min(5,total*.25),left=[],right=[];
        for(let i=0;i<clean.length;i++){
          const p=clean[i].xy;
          const prev=clean[i===0?(loop?clean.length-2:0):i-1].xy;
          const next=clean[i===clean.length-1?(loop?1:i):i+1].xy;
          const dx=next[0]-prev[0],dy=next[1]-prev[1],length=Math.hypot(dx,dy)||1;
          const t=loop?1:Math.min(1,distances[i]/tipLength,(total-distances[i])/tipLength);
          const taper=t*t*(3-2*t);
          const half=engravingWidth(width,clean[i].lit)*taper/2;
          left.push([p[0]-dy/length*half,p[1]+dx/length*half]);
          right.push([p[0]+dy/length*half,p[1]-dx/length*half]);
        }
        right.reverse();
        let d;
        if(o.optimizePaths){
          // Fit ribbon sides independently: never round across the tapered tips.
          // Thin ribbons get a tighter budget so the two sides cannot collapse.
          const tolerance=Math.min(.015,width*.025);
          d=compactPath(left,tolerance)+compactPath(right,tolerance).replace(/^M/,'L')+'Z';
        }else{
          const outline=left.concat(right);
          d=outline.map((p,i)=>(i?'L':'M')+p[0].toFixed(3)+' '+p[1].toFixed(3)).join('')+'Z';
        }
        target.push(`<path fill="${ink}" stroke="none" d="${d}"/>`);
      }
    }
    for(const s of spheres){
      curve(t=>{const a=t*Math.PI*2,n=[Math.cos(a),Math.sin(a),0];return {p:add(s.c,mul(n,s.r)),n};},Math.ceil(2*Math.PI*s.r*scale/0.65),o.outlineWidth*1.4);
      function hatch(axis,count,secondary){
        axis=norm(axis);
        const e=norm(cross(axis,[1,0,0])),f=cross(axis,e);
        for(let j=1;j<count;j++){
          const h=-1+2*j/count,r=Math.sqrt(1-h*h);
          curve(t=>{
            const a=t*Math.PI*2,n=add(mul(axis,h),mul(add(mul(e,Math.cos(a)),mul(f,Math.sin(a))),r));
            return {p:add(s.c,mul(n,s.r)),n};
          },Math.max(120,Math.ceil(2*Math.PI*s.r*scale*r/.7)),o.hatchWidth*(secondary?.63:.8),(n,p,lit)=>n[2]>=0 && lit<(secondary?.12:(j%2===0?.88:.58)),true,true,s.element);
        }
      }
      hatch([.12,1,.40],Math.max(10,Math.round(o.density*s.r/.48)),false);
      if(o.crossHatch) hatch([1,.22,-.32],Math.max(8,Math.round(o.density*.8*s.r/.48)),true);
    }
    for(const s of cylinders){
      const e=norm(cross(s.u,Math.abs(s.u[2])<.95?[0,0,1]:[0,1,0])),f=cross(s.u,e);
      const line=(n,w,engrave=false)=>curve(t=>({p:add(add(s.a,mul(s.u,t*s.length)),mul(n,s.r)),n}),Math.max(60,Math.ceil(s.length*scale/.7)),w,(normal,p,lit)=>!engrave||lit<.65,engrave);
      // True projected cylinder silhouette generators.
      if(Math.hypot(s.u[0],s.u[1])>1e-8){const edge=norm([-s.u[1],s.u[0],0]);line(edge,o.outlineWidth*1.1);line(mul(edge,-1),o.outlineWidth*1.1);}
      const count=Math.round(o.density*.8);
      for(let j=0;j<count;j++){
        const a=j/count*2*Math.PI,n=add(mul(e,Math.cos(a)),mul(f,Math.sin(a)));
        if(n[2]>0)line(n,o.hatchWidth*.68,true);
      }
    }
    let dots='';
    if(o.shadingMode!=='hatch'&&o.dotSize>0){
      const dotter=typeof module!=='undefined'&&module.exports?require('./dots.js'):root.MolDots;
      if(!dotter)throw new Error('Load dots.js before renderer.js');
      dots=dotter.buildDots(scene,depthAt,project,scale,illumination,o,coloredTexture?inkFor:null);
    }
    let texture='';
    if(coloredTexture){
      texture=`<g data-role="color-texture" fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round">${dots}${inkPaths.join('')}</g>`;
      if(o.washOffsetX!==0||o.washOffsetY!==0)texture=`<g data-role="color-registration" transform="translate(${o.washOffsetX} ${o.washOffsetY})">${texture}</g>`;
      dots='';
    }
    const fillFor=element=>o.colorWash&&!coloredTexture?elementColor(element,o.washStrength,o.colorSaturation):'#ffffff';
    let wash='';
    if(o.colorWash&&!coloredTexture&&o.washStrength>0){
      const helper=typeof module!=='undefined'&&module.exports?require('./wash.js'):root.MolWash;
      if(!helper) throw new Error('Missing wash.js: load it before renderer.js');
      wash=helper.buildWash(scene,depthAt,project,scale,fillFor);
      // Shift the already occlusion-resolved printing plate, without re-clipping.
      if(o.washOffsetX!==0||o.washOffsetY!==0)wash=`<g data-role="color-registration" transform="translate(${o.washOffsetX} ${o.washOffsetY})">${wash}</g>`;
    }
    let labels='';
    if(o.labels) for(const s of spheres){
      const p=add(s.c,[0,0,s.r]);
      if(!visible(p))continue;
      const [x,y]=project(p);
      // Optical baseline offset scales with font size instead of a fixed 5 units.
      labels+=`<text data-role="element-label" x="${x.toFixed(2)}" y="${(y+o.labelSize*.3).toFixed(2)}" text-anchor="middle" font-size="${o.labelSize}" font-family="${esc(o.labelFont)}" font-style="${o.labelItalic?'italic':'normal'}" font-weight="${o.labelBold?'700':'400'}" stroke="${o.labelStrokeWidth===0?'none':(o.labelMatchFill?fillFor(s.element):o.labelStrokeColor)}" stroke-width="${o.labelStrokeWidth}" stroke-linejoin="round" paint-order="stroke fill" fill="${o.labelColor}">${esc(s.element)}</text>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}" role="img" aria-labelledby="title"><title id="title">${esc(molecule.name||'Molecular engraving')}</title><rect width="100%" height="100%" fill="white"/>${wash}${dots}${texture}<g data-role="engraving" fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round">${paths.join('')}</g><g font-family="Georgia, 'Times New Roman', serif">${labels}<text x="${o.width/2}" y="${o.height-53}" text-anchor="middle" fill="#161616" font-size="19">${esc(molecule.name||'Molecular engraving')}</text><text x="${o.width/2}" y="${o.height-28}" text-anchor="middle" fill="#555" font-size="10" letter-spacing="2">ORTHOGRAPHIC • LINE ENGRAVING</text></g></svg>`;
  }
  const api={render,examples,depthAt,engravingWidth,elementColor,elementPalette,elementInkColor,elementInkPalette};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.MolEngraver=api;
})(typeof globalThis!=='undefined'?globalThis:this);
