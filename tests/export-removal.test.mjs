import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {trashRenderedExport,deleteRenderedExport} from '../desktop/export-removal.cjs';

test('permanently removes an owned export and companion report',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'auralith-export-'));try{const file=path.join(root,'mix.wav');await fs.writeFile(file,'wave');await fs.writeFile(file+'.json','{}');const project={id:'p',layers:[],background:{kind:'none'},exports:[{id:'e',path:file}]};await deleteRenderedExport({renders:root,project,exportId:'e',projects:[project]});await assert.rejects(fs.stat(file),{code:'ENOENT'});await assert.rejects(fs.stat(file+'.json'),{code:'ENOENT'});}finally{await fs.rm(root,{recursive:true,force:true});}});
test('only owned renders can be recycled; referenced files and outside paths are rejected',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'auralith-export-'));try{const file=path.join(root,'mix.wav');await fs.writeFile(file,'wave');await fs.writeFile(file+'.json','{}');const project={id:'p',layers:[],background:{kind:'none'},exports:[{id:'e',path:file}]};const calls=[];const trashItem=async f=>{calls.push(f);};await trashRenderedExport({renders:root,project,exportId:'e',projects:[project],trashItem});assert.deepEqual(calls,[file,file+'.json']);await assert.rejects(()=>trashRenderedExport({renders:root,project,exportId:'e',projects:[{id:'other',layers:[{path:file}],exports:[],background:{kind:'none'}}],trashItem}),/used|używan/);await assert.rejects(()=>trashRenderedExport({renders:root,project:{...project,exports:[{id:'e',path:path.join(root,'..','personal.wav')}]},exportId:'e',projects:[],trashItem}),/owned|aplikacji/);await assert.rejects(()=>trashRenderedExport({renders:root,project,exportId:'bad',projects:[],trashItem}));}finally{await fs.rm(root,{recursive:true,force:true});}});
test('failed recycle does not report success, and already missing files permit history cleanup',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'auralith-export-'));try{const file=path.join(root,'mix.wav');const project={id:'p',layers:[],background:{kind:'none'},exports:[{id:'e',path:file}]};await fs.writeFile(file,'wave');await assert.rejects(()=>trashRenderedExport({renders:root,project,exportId:'e',projects:[],trashItem:async()=>{throw Error('recycle unavailable');}}),/unavailable/);assert.equal(await fs.readFile(file,'utf8'),'wave');await fs.unlink(file);await trashRenderedExport({renders:root,project,exportId:'e',projects:[],trashItem:async()=>{throw Error('should not run');}});}finally{await fs.rm(root,{recursive:true,force:true});}});

test('report failure after recycling audio is surfaced without resurrecting the export',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'auralith-export-'));
 try{
  const file=path.join(root,'mix.wav');await fs.writeFile(file,'wave');await fs.writeFile(file+'.json','{}');
  const project={id:'p',layers:[],background:{kind:'none'},exports:[{id:'e',path:file}]};const calls=[];
  const result=await trashRenderedExport({renders:root,project,exportId:'e',projects:[project],trashItem:async candidate=>{calls.push(candidate);if(candidate.endsWith('.json'))throw Error('report locked');await fs.unlink(candidate);}});
  assert.equal(result.reportRetained,true);assert.deepEqual(calls,[file,file+'.json']);await assert.rejects(fs.stat(file),{code:'ENOENT'});assert.equal(await fs.readFile(file+'.json','utf8'),'{}');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('same-project background and duplicate export references prevent physical recycling',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'auralith-export-'));
 try{
  const file=path.join(root,'mix.wav');await fs.writeFile(file,'wave');
  const base={id:'p',layers:[],background:{kind:'none'},exports:[{id:'e',path:file}]};let calls=0;
  for(const project of [{...base,background:{kind:'file',path:file}},{...base,exports:[...base.exports,{id:'second',path:file}]}]){
   await assert.rejects(()=>trashRenderedExport({renders:root,project,exportId:'e',projects:[project],trashItem:async()=>{calls++;}}),/used|używan/);
  }
  assert.equal(calls,0);assert.equal(await fs.readFile(file,'utf8'),'wave');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
