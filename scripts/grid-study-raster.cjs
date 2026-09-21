'use strict';
// Dependency-free geometry preview, NOT a browser screenshot. Uses the same
// infinite-line/brick predicates as the SVG study; 4x4 subpixel supersampling.
const fs=require('node:fs'),zlib=require('node:zlib');
module.exports=function raster(grids,isInk,file) {
  const W=640,H=880,data=Buffer.alloc(W*H,255);
  const mod=(x,n)=>((x%n)+n)%n;
  const ink=(g,x,y)=>{
    const a=-(g.angle||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    return isInk(g,mod(c*x-s*y,g.w),mod(s*x+c*y,g.h));
  };
  function paint(x0,y0,x1,y1,predicate) {
    for(let y=Math.max(0,Math.floor(y0));y<Math.min(H,Math.ceil(y1));y++) for(let x=Math.max(0,Math.floor(x0));x<Math.min(W,Math.ceil(x1));x++) {
      let hits=0;
      for(let a=0;a<4;a++)for(let b=0;b<4;b++) if(predicate(x+(a+.5)/4,y+(b+.5)/4))hits++;
      data[y*W+x]=255-Math.round(233*hits/16);
    }
  }
  function circle(g,cx,cy,r,scale=1,occluded=false) {
    paint(cx-(r+1)*scale,cy-(r+1)*scale,cx+(r*(occluded?1.85:1)+1)*scale,cy+(r+1)*scale,(px,py)=>{
      const x=(px-cx)/scale,y=(py-cy)/scale,d=Math.hypot(x,y);
      if(occluded){const f=Math.hypot(x-r*.85,y);if(f<=r+.5)return f>=r-.5;}
      return Math.abs(d-r)<=.5 || (d<r-.5&&ink(g,x,y));
    });
  }
  const digits=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
  function number(n,x,y,k=3){String(n).split('').forEach((d,j)=>{for(let i=0;i<15;i++)if(digits[+d][i]==='1')for(let a=0;a<k;a++)for(let b=0;b<k;b++)data[(y+Math.floor(i/3)*k+b)*W+x+j*4*k+(i%3)*k+a]=22;});}
  [[64,113],[32,223],[16,303],[50,373],[33,433],[48,503]].forEach(([n,x])=>number(n,x,20,2));
  grids.forEach((g,i)=>{
    const y=88+i*100;
    number(i+1,20,y-7);
    circle(g,125,y,32);circle(g,235,y,16);circle(g,315,y,8);
    circle(g,385,y,32,.5);circle(g,445,y,32,1/3);circle(g,515,y,24,1,true);
    paint(572,y-32,636,y+32,(x,v)=>ink(g,x-572,v-y+32));
  });
  const table=Array.from({length:256},(_,i)=>{for(let k=0;k<8;k++)i=(i&1)?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
  function chunk(type,body){const name=Buffer.from(type),all=Buffer.concat([name,body]);let crc=0xffffffff;for(const b of all)crc=table[(crc^b)&255]^(crc>>>8);const size=Buffer.alloc(4),tail=Buffer.alloc(4);size.writeUInt32BE(body.length);tail.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([size,all,tail]);}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=0;
  const raw=Buffer.alloc((W+1)*H);for(let y=0;y<H;y++)data.copy(raw,y*(W+1)+1,y*W,(y+1)*W);
  fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
};
