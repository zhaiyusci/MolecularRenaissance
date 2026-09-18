/* Deterministic, depth-aware SVG stipple and 45-degree halftone screens. */
(function(root){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function hash(x,y,salt){
    let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(salt,1274126177);
    h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
  }
  function candidate(i,j,g){return [(i+.5+.8*(hash(i,j,1)-.5))*g,(j+.5+.8*(hash(i,j,2)-.5))*g];}
  function separated(i,j,p,g){
    // Independent local thinning of a jittered lattice: stable across frames,
    // no random clumps or order-dependent placement. Not a strict blue-noise solver.
    const rank=hash(i,j,3),limit=(.5*g)**2;
    for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
      if(!di&&!dj)continue;
      const q=candidate(i+di,j+dj,g),other=hash(i+di,j+dj,3);
      if((q[0]-p[0])**2+(q[1]-p[1])**2<limit&&(other<rank||(other===rank&&(dj<0||(dj===0&&di<0)))))return false;
    }
    return true;
  }
  function buildDots(scene,depthAt,project,scale,illumination,options,colorForElement=null){
    if(colorForElement!==null&&typeof colorForElement!=='function')throw new Error('Invalid dot color callback');
    const o={shadingMode:'stipple',dotSpacing:5,dotSize:1,dotContrast:1.2,...options};
    if(!['stipple','halftone'].includes(o.shadingMode))throw new Error('Invalid dot mode');
    if(!Number.isFinite(o.dotSpacing)||o.dotSpacing<2||o.dotSpacing>14||!Number.isFinite(o.dotSize)||o.dotSize<0||o.dotSize>1.5||!Number.isFinite(o.dotContrast)||o.dotContrast<.5||o.dotContrast>2.5)throw new Error('Invalid dot settings');
    if(!(scale>0)||!Number.isFinite(scale))throw new Error('Invalid scale');
    if(o.dotSize===0||scene.length===0)return '';
    const origin=project([0,0,0]),g=o.dotSpacing;
    const shapes=scene.map((s,id)=>{
      const a=project(s.kind==='sphere'?s.c:s.a);
      const b=s.kind==='sphere'?a:project(s.a.map((v,i)=>v+s.u[i]*s.length));
      const r=s.r*scale;
      return {s,id,b:[Math.min(a[0],b[0])-r,Math.min(a[1],b[1])-r,Math.max(a[0],b[0])+r,Math.max(a[1],b[1])+r]};
    });
    const minX=Math.min(...shapes.map(s=>s.b[0])),minY=Math.min(...shapes.map(s=>s.b[1]));
    const maxX=Math.max(...shapes.map(s=>s.b[2])),maxY=Math.max(...shapes.map(s=>s.b[3]));
    function hit(x,y){
      const wx=(x-origin[0])/scale,wy=(origin[1]-y)/scale;
      let best=-Infinity,item=null;
      for(const shape of shapes){
        const b=shape.b;if(x<b[0]||y<b[1]||x>b[2]||y>b[3])continue;
        const z=depthAt(shape.s,wx,wy);
        if(Number.isFinite(z)&&z>best){best=z;item=shape;}
      }
      return item?{id:item.id,s:item.s,p:[wx,wy,best]}:null;
    }
    function normal(h){
      const s=h.s,p=h.p;
      if(s.kind==='sphere')return p.map((v,i)=>(v-s.c[i])/s.r);
      const q=p.map((v,i)=>v-s.a[i]),t=q.reduce((sum,v,i)=>sum+v*s.u[i],0);
      if(t<1e-7)return s.u.map(v=>-v);
      if(t>s.length-1e-7)return s.u.slice();
      const radial=q.map((v,i)=>v-t*s.u[i]),length=Math.hypot(...radial);
      return length?radial.map(v=>v/length):[0,0,1];
    }
    const dirs=Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8),Math.sin(i*Math.PI/8)]);
    function safeRadius(x,y,r,owner){
      // The whole sampled disk must stay on the same visible primitive, not
      // merely its center. Shrink at silhouettes and occlusion boundaries.
      // Two rings are a numerical footprint test, not an exact curve boolean.
      function fits(radius){
        for(const k of [.5,1])for(const d of dirs){
          const h=hit(x+d[0]*radius*k,y+d[1]*radius*k);
          if(!h||h.id!==owner)return false;
        }
        return true;
      }
      if(fits(r))return r;
      let lo=0,hi=r;
      for(let i=0;i<9;i++){const mid=(lo+hi)/2;if(fits(mid))lo=mid;else hi=mid;}
      return lo;
    }
    const circles=[];
    function emit(x,y,i,j){
      if(x<minX||y<minY||x>maxX||y>maxY)return;
      const h=hit(x,y);if(!h)return;
      const n=normal(h),lit=clamp(illumination(n,h.p),-1,1);
      let radius;
      if(o.shadingMode==='stipple'){
        // Form tone, not dust density: signed diffuse shading plus a modest
        // grazing-angle term. Strong light still leaves a clean highlight.
        const rim=(1-clamp(n[2],0,1))**2;
        const tone=Math.pow(clamp((.94-lit)/1.5+.08*rim,0,1),o.dotContrast);
        if(tone<.006)return;
        const probability=Math.min(1,1.7*Math.sqrt(tone));
        if(hash(i,j,4)>=probability)return;
        // Approximate target ink AREA. Jitter/min-distance thinning retains
        // ~83% of sites. Both number and diameter contribute to the tone;
        // dark marks may touch, as in dense engraved stippling.
        const coverage=.58*tone;
        radius=Math.min(g*Math.sqrt(coverage/(Math.PI*.83*probability))*o.dotSize,g*.48);
      }else{
        const shade=Math.pow(clamp((.92-lit)/1.92,0,1),o.dotContrast);
        if(shade<.008)return;
        radius=Math.min(g*.48*o.dotSize*Math.sqrt(shade),g*.48);
      }
      if(radius<.12)return;
      radius=safeRadius(x,y,radius,h.id);
      // Inscribed safety margin between the 16 tested directions, plus output
      // rounding budget. Without it, a circle can leak between footprint probes.
      radius=Math.floor(Math.max(0,radius*Math.cos(Math.PI/16)-.003)*1000)/1000;
      if(radius<.12)return;
      let color='';
      if(colorForElement){
        const value=colorForElement(h.s.kind==='sphere'?h.s.element:null);
        if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw new Error('Invalid dot ink color');
        color=` fill="${value}"`;
      }
      circles.push(`<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${radius.toFixed(3)}"${color}/>`);
    }
    if(o.shadingMode==='stipple'){
      const i0=Math.floor(minX/g)-1,i1=Math.ceil(maxX/g)+1,j0=Math.floor(minY/g)-1,j1=Math.ceil(maxY/g)+1;
      if((i1-i0+1)*(j1-j0+1)>1000000)throw new Error('Dot screen too large; increase spacing or reduce output size');
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
        const p=candidate(i,j,g);if(separated(i,j,p,g))emit(p[0],p[1],i,j);
      }
    }else{
      const c=Math.SQRT1_2;
      const corners=[[minX,minY],[minX,maxY],[maxX,minY],[maxX,maxY]];
      const us=corners.map(p=>(p[0]+p[1])*c/g),vs=corners.map(p=>(-p[0]+p[1])*c/g);
      const i0=Math.floor(Math.min(...us))-1,i1=Math.ceil(Math.max(...us))+1,j0=Math.floor(Math.min(...vs))-1,j1=Math.ceil(Math.max(...vs))+1;
      if((i1-i0+1)*(j1-j0+1)>1000000)throw new Error('Dot screen too large; increase spacing or reduce output size');
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)emit(((i+.5)-(j+.5))*g*c,((i+.5)+(j+.5))*g*c,i,j);
    }
    return `<g data-role="dots" data-mode="${o.shadingMode}" fill="#161616" stroke="none">${circles.join('')}</g>`;
  }
  const api={buildDots};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MolDots=api;
})(typeof globalThis!=='undefined'?globalThis:this);
