'use strict';
const cases=[];
for(const model of ['sphere','pair','water','ethanol','c60']){
 for(const shadingMode of ['hatch','stipple','halftone']){
  for(const quality of ['preview','export'])cases.push({id:`${model}-${shadingMode}-${quality}`,model,options:{shadingMode,quality,colorWash:true}});
  cases.push({id:`${model}-${shadingMode}-point-ink`,model,options:{shadingMode,quality:'export',colorWash:true,colorMode:'ink',lightType:'point',lightDistance:1.8,yaw:.73,pitch:.41,variableWidth:false,shadingDensity:1.3,shadingSize:.85,shadingContrast:2.2,labels:true,labelMatchFill:true}});
 }
}
for(const yaw of [0,Math.PI/4,Math.PI/2])cases.push({id:`c60-symmetry-${yaw}`,model:'c60',options:{yaw,pitch:0,quality:'preview',shadingSize:0,colorWash:true}});
cases.push({id:'pair-legacy-controls',model:'pair',options:{density:27,lineWidth:.6,dotSpacing:4,labels:true,optimizePaths:false}});
module.exports=cases;
