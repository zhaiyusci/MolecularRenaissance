'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const base=pathToFileURL(path.resolve('.')+path.sep).href;
const setup=`<script>
window.addEventListener('load',function(){setTimeout(function(){
 const by=id=>document.getElementById(id),change=(id,value)=>{const e=by(id);if(typeof value==='boolean')e.checked=value;else e.value=value;e.dispatchEvent(new Event('change'));};
 change('language','en');change('model','glycine');change('shading-enabled',false);change('color-wash',false);change('element-textures',true);
 by('element-textures').closest('details').open=true;
 requestAnimationFrame(function(){
  const before=by('preview').innerHTML;
  by('light-azimuth').value='70';by('light-azimuth').dispatchEvent(new Event('input'));
  requestAnimationFrame(function(){
   const svg=by('preview').querySelector('svg');
   const ok=before===by('preview').innerHTML&&svg.querySelectorAll('[data-role="element-pattern"]').length===4&&svg.querySelectorAll('[data-role="element-texture"]').length>0&&!svg.querySelector('image,filter')&&!by('element-texture-scale').disabled&&by('element-texture-legend').querySelectorAll('svg').length===4&&!by('download').disabled;
   document.body.setAttribute('data-element-texture-check',ok?'passed':'FAILED');
   const p=document.createElement('p');p.textContent='Element textures / light independence: '+(ok?'PASS':'FAIL');document.body.appendChild(p);
  });
 });
},100);});
</script>`;
fs.mkdirSync('build',{recursive:true});
fs.writeFileSync('build/element-textures-check.html',fs.readFileSync('index.html','utf8').replace('<head>','<head><base href="'+base+'">').replace('</body>',setup+'</body>'));
console.log('Created build/element-textures-check.html from actual UI; checks unchanged pattern image when light changes.');
