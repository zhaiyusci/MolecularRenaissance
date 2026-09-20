// Generate a local, disposable screenshot harness of the actual main page; no extra server.
// Edge --dump-dom can run before the first animation frame even when its later
// screenshot is correct. Inspect the post-paint screenshot, not that early dump.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const base=new URL('../',import.meta.url).href;
const setup=`<script>
requestAnimationFrame(function(){
  document.getElementById('model').value='c60';
  document.getElementById('fast-overlay').checked=true;
  document.getElementById('fast-overlay').dispatchEvent(new Event('change'));
  var timer=setInterval(function(){
    var svg=document.querySelector('#preview svg');
    if(svg&&svg.getAttribute('data-render-mode')==='fast'&&svg.getAttribute('data-sphere-count')==='60'){
      document.body.setAttribute('data-fast-ui-check','passed');
      clearInterval(timer);
    }
  },50);
});
</script>`;
const html=readFileSync('index.html','utf8').replace('<head>',`<head><base href="${base}">`).replace('</body>',setup+'</body>');
mkdirSync('build',{recursive:true});writeFileSync('build/fast-page-check.html',html);
console.log('Created build/fast-page-check.html from the actual main page.');
