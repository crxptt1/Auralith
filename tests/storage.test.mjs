import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createStore}=require('../desktop/storage.cjs');
const root=await fs.mkdtemp(path.join(os.tmpdir(),'auralith-store-'));
test.after(()=>fs.rm(root,{recursive:true,force:true}));
test('save uses project id and round-trips Unicode without touching other projects',async()=>{
 const store=createStore(root);await store.init();
 await store.saveProject({id:'one',name:'Mój głos'});await store.saveProject({id:'two',name:'Drugi'});
 assert.equal((await store.listProjects()).length,2);
 assert.equal((await store.listProjects()).find(p=>p.id==='one').name,'Mój głos');
});
test('traversal ids and paths are rejected',async()=>{
 const store=createStore(root);
 await assert.rejects(()=>store.saveProject({id:'../outside',name:'X'}));
 assert.throws(()=>store.managedPath('../outside.wav'));
 assert.equal(store.isManaged(path.join(root,'assets','a.wav')),true);
 assert.equal(store.isManaged(path.join(root,'assets-evil','a.wav')),false);
});
test('corrupt project does not prevent recovery of intact projects',async()=>{
 const store=createStore(root);await fs.writeFile(path.join(root,'projects','broken.json'),'{');
 const result=await store.listProjects();assert.equal(result.length,2);
});
