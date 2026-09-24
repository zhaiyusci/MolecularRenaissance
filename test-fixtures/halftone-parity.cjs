'use strict';
const assert=require('node:assert/strict');
// Halftone's cumulative -> exclusive-band migration changes tone clip delivery,
// not palette geometry, owner fills, outlines, captions, or document metadata.
// Strip whole BALANCED dots groups, not a lazy regexp ending at an inner </g>.
function outsideDots(svg){
 let start=-1,depth=0,last=0,out='',count=0;
 for(const m of svg.matchAll(/<\/?g\b[^>]*>/g)){
  const tag=m[0],closing=tag.startsWith('</'),selfClosing=tag.endsWith('/>');
  if(start<0){
   if(!closing&&/\bdata-role="dots"/.test(tag)){
    start=m.index;depth=selfClosing?0:1;count++;
    if(selfClosing){out+=svg.slice(last,start);last=m.index+tag.length;start=-1;}
   }
   continue;
  }
  if(closing)depth--;else if(!selfClosing)depth++;
  if(depth===0){out+=svg.slice(last,start);last=m.index+tag.length;start=-1;}
 }
 assert.equal(start,-1,'balanced dots groups');
 return {svg:out+svg.slice(last),count};
}
function assertHalftonePaintMigration(actual,expected,label){
 const patterns=svg=>[...svg.matchAll(/<pattern\b[^>]*>[\s\S]*?<\/pattern>/g)].map(m=>m[0]);
 const a=patterns(actual),b=patterns(expected);assert(a.length&&b.length,`${label}: real halftone pattern definitions exist`);
 assert.deepEqual(a,b,`${label}: exact pattern coverage, radii, wrap copies, grid phase and IDs unchanged`);
 const outerA=outsideDots(actual),outerB=outsideDots(expected);
 assert(outerA.count&&outerB.count,`${label}: complete dots groups exist`);
 assert.equal(outerA.count,outerB.count,`${label}: same number of texture groups`);
 assert.equal(outerA.svg,outerB.svg,`${label}: exact non-texture SVG (fills, outlines and metadata) unchanged`);
}
module.exports={assertHalftonePaintMigration};
