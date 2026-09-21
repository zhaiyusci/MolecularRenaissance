'use strict';
// Example is produced by the ACTUAL app renderer, not the design-study painter.
const fs=require('node:fs'),assert=require('node:assert/strict');
const api=require('../renderer.js');
const elements=['H','C','O','N','S','P','F','Cl','Br','I','B','Si','Se','Li','Na','K','Mg','Ca','Al'];
const atoms=elements.map((element,i)=>({element,position:[(i%5)*5,-Math.floor(i/5)*5,0]}));
const svg=api.render({atoms,bonds:[]},{width:1000,height:800,scale:35,yaw:0,pitch:0,elementTextures:true,elementTextureScale:1,shadingSize:0,castShadows:false,colorWash:false,labels:true,labelHydrogens:true,labelSize:16,quality:'export',renderMode:'precise'});
assert.equal((svg.match(/data-role="element-pattern"/g)||[]).length,19);
assert(!/<(?:image|filter)\b/.test(svg));
fs.mkdirSync('design/element-textures',{recursive:true});
fs.writeFileSync('design/element-textures/app-approved-19.svg',svg);
fs.writeFileSync('design/element-textures/app-approved-19.xyz',`${atoms.length}\nIndependent atom texture chart, not a bonded molecule\n${atoms.map(a=>`${a.element} ${a.position.join(' ')}`).join('\n')}\n`);
console.log('PASS: exported 19-element sample through actual renderer; XYZ import fixture uses separated atoms.');
