'use strict';
// Generate a disposable page from the real UI, including its real CSS and scripts.
const fs=require('node:fs'),{pathToFileURL}=require('node:url'),path=require('node:path');
const base=pathToFileURL(path.resolve('.')+path.sep).href;
const check=`<script>
window.addEventListener('load',function(){setTimeout(function(){
 const language=document.getElementById('language');language.value='en';language.dispatchEvent(new Event('change'));
 const root=document.getElementById('rotation-gizmo'),svg=root.querySelector('svg');
 const ring=svg.querySelector('[data-axis="x"][data-front="true"]');
 ring.focus({preventScroll:true});ring.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
 requestAnimationFrame(function(){
  const transparent=n=>getComputedStyle(n).backgroundColor==='rgba(0, 0, 0, 0)';
  const ok=transparent(root)&&transparent(svg)&&getComputedStyle(svg).outlineStyle==='none'&&getComputedStyle(ring).outlineStyle==='none'&&document.activeElement===ring&&!root.querySelector('img,image')&&ring.getAttribute('stroke-opacity')==='0.24';
  document.body.setAttribute('data-gizmo-light-check',ok?'passed':'FAILED');
  const report=document.createElement('p');report.id='gizmo-browser-check';report.textContent='Focused light gizmo: '+(ok?'PASS':'FAIL');document.body.appendChild(report);
 });
},100);});
</script>`;
const html=fs.readFileSync('index.html','utf8').replace('<head>','<head><base href="'+base+'">').replace('</body>',check+'</body>');
fs.mkdirSync('build',{recursive:true});fs.writeFileSync('build/gizmo-light-check.html',html);
console.log('Created build/gizmo-light-check.html; screenshot after load to inspect a focused ring.');
