import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { rollup } from 'rollup';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=ts.readConfigFile(path.join(root,'tsconfig.json'),ts.sys.readFile);
if(config.error)throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
const program=ts.createProgram(parsed.fileNames,parsed.options);
const diagnostics=[...parsed.errors,...ts.getPreEmitDiagnostics(program)];
function report(items){
  console.error(ts.formatDiagnosticsWithColorAndContext(items,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
}
if(diagnostics.length){report(diagnostics);process.exit(1);}
const staged=new Map();
function put(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
const emitted=program.emit(undefined,(file,text)=>{
  // Do not update distributed declarations/artifacts until all bundles succeed.
  if(file.endsWith('.d.ts'))staged.set(file,text);else put(file,text);
});
if(emitted.emitSkipped||emitted.diagnostics.length){report(emitted.diagnostics);process.exit(1);}
const entries={renderer:'MolEngraver',boundaries:'MolBoundaries',wash:'MolWash',dots:'MolDots','dot-regions':'MolDotRegions'};
const adapters=new Set(['runtime.js','region-runtime.js'].map(file=>path.join(root,'build/ts',file)));
const legacyRuntime=path.join(root,'build/ts/runtime-legacy.js');
const legacyAdapter={name:'legacy-runtime',resolveId(source,importer){
  if(importer&&source.startsWith('.')&&adapters.has(path.resolve(path.dirname(importer),source)))return legacyRuntime;
  return null;
}};
for(const [entry,name] of Object.entries(entries)){
  const bundle=await rollup({input:path.join(root,'build/ts',entry+'.js'),plugins:[legacyAdapter]});
  try{
    const {output}=await bundle.generate({format:'iife',name,exports:'named',generatedCode:'es2015',
      banner:`/* Generated from src/${entry}.ts by npm run build. Edit TypeScript, not this file. */`,
      footer:`if (typeof module !== 'undefined' && module.exports) module.exports = ${name};`});
    staged.set(path.join(root,entry+'.js'),output[0].code);
  }finally{await bundle.close();}
}
// Canonical sources bundle directly as ESM, with no compatibility globals.
const bundle=await rollup({input:path.join(root,'build/ts/renderer.js')});
try{
  const {output}=await bundle.generate({format:'es',generatedCode:'es2015',banner:'/* Generated DOM-free ES module. Source: src/renderer.ts. */'});
  staged.set(path.join(root,'dist/molplotter.mjs'),output[0].code);
}finally{await bundle.close();}
// This directory is generated in full; remove declarations for deleted sources.
fs.rmSync(path.join(root,'dist/types'),{recursive:true,force:true});
for(const [file,text] of staged)put(file,text);
console.log('Built classic-script/CommonJS modules, standalone ESM, and TypeScript declarations.');
