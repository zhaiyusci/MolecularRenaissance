'use strict';
// A small deterministic DOM fixture for the classic page scripts. No browser dependencies.
const fs=require('node:fs'),vm=require('node:vm');
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&nbsp;':' '})[x]);
class Element {
 constructor(tag,attrs={},doc){this.nodeType=1;this.tagName=tag.toUpperCase();this.attrs=attrs;this.ownerDocument=doc;this.children=[];this.listeners={};this._listeners={};this._captures=new Set();this.style={};this.checked='checked' in attrs;this.disabled='disabled' in attrs;this.hidden='hidden' in attrs;this.readOnly='readonly' in attrs;this._value=attrs.value;this.classList={add:(...names)=>{this.attrs.class=[...new Set([...(this.attrs.class||'').split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names)=>{this.attrs.class=(this.attrs.class||'').split(/\s+/).filter(n=>!names.includes(n)).join(' ');},contains:name=>(this.attrs.class||'').split(/\s+/).includes(name),toggle:(name,on)=>{const add=on??!this.classList.contains(name);this.classList[add?'add':'remove'](name);return add;}};}
 get parentNode(){return this.parent||null;}get parentElement(){return this.parentNode;}get firstChild(){return this.children[0]||null;}get childNodes(){return this.children;}get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));}
 get id(){return this.attrs.id;}get value(){if(this._value!==undefined)return this._value;if(this.tagName==='SELECT'){const a=this.children.find(x=>x.tagName==='OPTION'&&x.hasAttribute('selected'))||this.children.find(x=>x.tagName==='OPTION');return a?a.value:'';}return '';}
 set value(v){this._value=String(v);}get textContent(){return this.children.map(x=>typeof x==='string'?x:x.textContent).join('');}
 set textContent(v){this.children=[String(v)];}get innerHTML(){return this._html||'';}set innerHTML(s){this._html=s;this.children=[];parse(s,this,this.ownerDocument);}
 appendChild(x){if(x.parent)x.remove();this.children.push(x);if(typeof x!=='string'){x.parent=this;if(x.id)this.ownerDocument.nodes[x.id]=x;}return x;}remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
 removeChild(x){x.remove();return x;}replaceChildren(...children){for(const c of this.children)if(typeof c!=='string')c.parent=null;this.children=[];for(const c of children)this.appendChild(c);}
 setAttribute(k,v){if(k==='id'&&this.id)delete this.ownerDocument.nodes[this.id];this.attrs[k]=String(v);if(k==='id')this.ownerDocument.nodes[String(v)]=this;}getAttribute(k){return this.attrs[k]??null;}hasAttribute(k){return k in this.attrs;}removeAttribute(k){if(k==='id')delete this.ownerDocument.nodes[this.id];delete this.attrs[k];}
 addEventListener(k,f){const list=this._listeners[k]||(this._listeners[k]=[]);if(!list.includes(f))list.push(f);this.listeners[k]=e=>{let result;for(const fn of [...this._listeners[k]])result=fn.call(this,e);return result;};}
 removeEventListener(k,f){this._listeners[k]=(this._listeners[k]||[]).filter(fn=>fn!==f);if(!this._listeners[k].length)delete this.listeners[k];}
 dispatchEvent(e){e.target??=this;e.currentTarget=this;e.preventDefault??=()=>{e.defaultPrevented=true;};e.stopPropagation??=()=>{e.cancelBubble=true;};this.listeners[e.type]?.(e);if(e.bubbles&&!e.cancelBubble)this.parent?.dispatchEvent(e);return !e.defaultPrevented;}
 click(){if(this.disabled)return;if(this.tagName==='A')this.ownerDocument.downloads.push(this.download);return this.listeners.click?.({stopPropagation(){},preventDefault(){}});}
 matches(s){if(s[0]==='#')return this.id===s.slice(1);const a=s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return a?(a[1] in this.attrs&&(a[2]===undefined||this.attrs[a[1]]===a[2])):this.tagName.toLowerCase()===s;}
 querySelectorAll(s){const out=[];for(const c of this.children)if(typeof c!=='string'){if(c.matches(s))out.push(c);out.push(...c.querySelectorAll(s));}return out;}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 setPointerCapture(id){this._captures.add(id);}hasPointerCapture(id){return this._captures.has(id);}releasePointerCapture(id){if(this._captures.delete(id))this.dispatchEvent({type:'lostpointercapture',pointerId:id});}
 focus(){if(this.ownerDocument.activeElement===this)return;this.ownerDocument.activeElement?.blur();this.ownerDocument.activeElement=this;this.dispatchEvent({type:'focus'});}blur(){if(this.ownerDocument.activeElement===this)this.ownerDocument.activeElement=this.ownerDocument.body;this.dispatchEvent({type:'blur'});}
 getBoundingClientRect(){return this.rect||{left:0,top:0,x:0,y:0,width:240,height:240,right:240,bottom:240};}
 getBBox(){return {x:0,y:0,width:240,height:240};}contains(el){return el===this||this.children.some(c=>typeof c!=='string'&&c.contains(el));}closest(selector){return this.matches(selector)?this:this.parent?.closest(selector)||null;}
}
function parse(html,parent,doc){
 const stack=[parent],voids=new Set(['meta','input','link','br','hr','img']);
 for(const token of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>|[^<]+/g)){
  const s=token[0];if(s.startsWith('<!'))continue;
  if(s.startsWith('</')){if(stack.length>1)stack.pop();continue;}
  if(s[0]!=='<'){stack.at(-1).appendChild(decode(s));continue;}
  const tag=s.match(/^<([\w:-]+)/)[1].toLowerCase(),attrs={};
  for(const a of s.slice(tag.length+1,-1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[a[1]]=decode(a[2]??a[3]??a[4]??'');
  const el=new Element(tag,attrs,doc);if(el.id)doc.nodes[el.id]=el;stack.at(-1).appendChild(el);
  if(!voids.has(tag)&&!s.endsWith('/>'))stack.push(el);
 }
}
function makeUI(options={}){
 const html=fs.readFileSync('index.html','utf8'),document=new Element('document');document.nodeType=9;document.ownerDocument=document;document.nodes={};document.downloads=[];
 document.getElementById=id=>document.nodes[id];document.createElement=tag=>new Element(tag,{},document);document.createElementNS=(namespace,tag)=>{const el=document.createElement(tag);el.namespaceURI=namespace;return el;};parse(html,document,document);
 document.documentElement=document.querySelector('html');document.body=document.querySelector('body');
 Object.defineProperty(document,'title',{get(){return document.querySelector('title').textContent;},set(v){document.querySelector('title').textContent=v;}});
 document.activeElement=document.body;
 const api=require('../renderer.js'),calls=[],store=options.store||{},queue=[],windowTarget=new Element('window',{},document),windowListeners=windowTarget.listeners;
 document.parent=windowTarget;
 const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 let fail=options.fail;
 const context={document,navigator:{language:options.browserLanguage||'en-US'},localStorage:{getItem(k){if(options.storageThrows)throw Error('blocked');return store[k]??null;},setItem(k,v){if(options.storageThrows)throw Error('blocked');store[k]=v;}},
 MolEngraver:{elementTexturePattern:api.elementTexturePattern,elementTextureDefinition:api.elementTextureDefinition,elementTextureSwatch:api.elementTextureSwatch,examples:api.examples,parseXYZ:api.parseXYZ,normalizeOrientation:api.normalizeOrientation,rotateOrientation:api.rotateOrientation,orientationFromEulerXYZ:api.orientationFromEulerXYZ,orientationToEulerXYZ:api.orientationToEulerXYZ,render(model,opts){calls.push({model,options:{...opts}});if(fail)throw fail;return `<svg><title>${escape(model.name||'')}</title><circle/></svg>`;}},
 addEventListener:windowTarget.addEventListener.bind(windowTarget),removeEventListener:windowTarget.removeEventListener.bind(windowTarget),dispatchEvent:windowTarget.dispatchEvent.bind(windowTarget),requestAnimationFrame:f=>{queue.push(f);return queue.length;},performance:{now:()=>0},Blob:class{},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout(){},console};
 if(options.missingEngine)delete context.MolEngraver;
 context.window=context;
  if(options.configureContext)options.configureContext(context);
  vm.createContext(context);
 for(const file of ['i18n.js','i18n-messages.js','rotation-gizmo.js',...(options.skipApp?[]:['app.js'])])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 const nodes=document.nodes;
 function flush(){if(!queue.length)throw Error('No frame queued');queue.shift()();}
 function change(id,value){const e=nodes[id];if(typeof value==='boolean')e.checked=value;else e.value=value;return e.listeners.change?.();}
 function locale(value){change('language',value);}
 async function upload(name,text,size=200){nodes['xyz-file'].files=[{name,size,text:()=>Promise.resolve(text)}];return nodes['xyz-file'].listeners.change();}
 function ring(axis){const el=nodes['rotation-gizmo'].querySelectorAll(`[data-axis="${axis}"]`).find(node=>node.getAttribute('tabindex')==='0');if(!el)throw Error('Missing gizmo ring '+axis);return el;}
 function key(axis,key='ArrowRight',shiftKey=false){return ring(axis).dispatchEvent({type:'keydown',key,shiftKey,bubbles:true});}
 function pointer(target,type,extra={}){const el=typeof target==='string'?(target==='window'?windowTarget:nodes[target]):target;return el.dispatchEvent({type,bubbles:true,button:0,buttons:type==='pointerup'?0:1,isPrimary:true,pointerType:'mouse',pointerId:7,clientX:220,clientY:120,...extra});}
 return {html,document,elements:nodes,context,calls,store,queue,windowListeners,flush,change,locale,upload,ring,key,pointer,downloads:document.downloads,setFailure(e){fail=e;}};
}
// Independent Hamilton product oracle: local rings postmultiply, camera ring premultiplies.
function multiply(a,b){const [x,y,z,w]=a,[X,Y,Z,W]=b;return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];}
function rotateRing(q,axis,radians){const delta=[0,0,0,Math.cos(radians/2)];delta[{x:0,y:1,z:2,screen:2}[axis]]=Math.sin(radians/2);return axis==='screen'?multiply(delta,q):multiply(q,delta);}
module.exports={makeUI,Element,rotateRing};
