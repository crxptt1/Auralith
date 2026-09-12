import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {removePreviousPreviews} from '../desktop/preview-cleanup.cjs';

test('keeps the current managed preview and removes only older preview audio',async()=>{
 const renders=await fs.mkdtemp(path.join(os.tmpdir(),'auralith-preview-'));
 try{
  const keep=path.join(renders,'calm_LOW_preview_current.wav');
  const old=path.join(renders,'calm_LOW_preview_old.wav');
  const exportFile=path.join(renders,'calm_LOW_export.wav');
  await Promise.all([fs.writeFile(keep,'keep'),fs.writeFile(old,'old'),fs.writeFile(exportFile,'export')]);
  await removePreviousPreviews({renders,keepPath:keep});
  assert.equal(await fs.readFile(keep,'utf8'),'keep');
  await assert.rejects(fs.stat(old),{code:'ENOENT'});
  assert.equal(await fs.readFile(exportFile,'utf8'),'export');
 }finally{await fs.rm(renders,{recursive:true,force:true});}
});
