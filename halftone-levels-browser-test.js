/* SVG-only browser regression. Canvas is used only to READ reference pixels in
 * this test, never as a production preview/export path. Load after dots.js and
 * renderer.js, then await runHalftoneLevelBrowserTests(). */
(function(root){
 'use strict';
 root.runHalftoneLevelBrowserTests=async function(){
  const levels=[4,8,16,32,64],rows=[],scene=[{kind:'sphere',c:[0,0,0],r:1}],scale=100,width=256,height=256;
  const project=p=>[128+p[0]*scale,128-p[1]*scale];
  async function centerInk(svg,ratio){
   const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);});
   const canvas=document.createElement('canvas');canvas.width=width*ratio;canvas.height=height*ratio;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
   const data=ctx.getImageData(112*ratio,112*ratio,32*ratio,32*ratio).data;let ink=0;for(let i=0;i<data.length;i+=4)ink+=(765-data[i]-data[i+1]-data[i+2])/(3*233);return ink/(data.length/4);
  }
  for(const coverage of [.25,.5,.75,1])for(const textureScale of [.2,1,2.5])for(const ratio of [1,2,4]){
   const samples=[];
   for(const shadingLevels of levels){
    // A shared palette value inside the ROI, but different contours outside:
    // this prevents identical-path deduplication from hiding repeated overprint.
    const illumination=(_n,p)=>{const t=Math.sign(p[0])*Math.max(0,(Math.abs(p[0])-.35)/.65);return 1-2*Math.max(0,Math.min(1,coverage+t));};
    const body=root.MolDots.buildDots(scene,root.MolEngraver.depthAt,project,scale,illumination,{width,height,quality:'preview',shadingMode:'halftone',dotSpacing:7.5*textureScale,dotSize:1.5*textureScale,dotContrast:1,shadingLevels,quantizeShading:true});
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="white"/>'+body+'</svg>';
    samples.push({levels:shadingLevels,ink:await centerInk(svg,ratio)});
   }
   const drift=Math.max(...samples.map(x=>x.ink))-Math.min(...samples.map(x=>x.ink));rows.push({coverage,textureScale,pixelRatio:ratio,samples,drift});
   if(drift>.003)throw Error('Halftone level-count overprint: '+JSON.stringify(rows.at(-1)));
  }
  return {pass:true,cases:rows.length*levels.length,maxCoverageDrift:Math.max(...rows.map(r=>r.drift)),rows};
 };
}(typeof globalThis!=='undefined'?globalThis:this));
