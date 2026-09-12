import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {createAudioEngine} from '../desktop/audio.mjs';

test('render extends the session to retain a complete active vocal take',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'auralith-duration-'));
 try{
  const ffmpegPath=process.env.FFMPEG_PATH||path.resolve('vendor/ffmpeg.exe');
  const voice=path.join(dir,'voice.wav');
  const generated=spawnSync(ffmpegPath,['-v','error','-y','-f','lavfi','-i','sine=frequency=900:sample_rate=48000:duration=7',voice],{windowsHide:true,encoding:'utf8'});
  assert.equal(generated.status,0,generated.stderr);
  const engine=createAudioEngine({ffmpegPath,workDir:path.join(dir,'work')});
  const result=await engine.render({outputPath:path.join(dir,'out.wav'),duration:5,variant:'CLEAR',format:'wav',targetLufs:-30,background:{kind:'none',gainDb:-18},pulse:{enabled:false,hz:6,depth:.2},layers:[{path:voice,gainDb:0,pan:0,speed:1,reverse:false,offset:0,muted:false,solo:false}]});
  assert.ok(result.duration>=6.9,`expected complete 7 s take, got ${result.duration}`);
 }finally{await rm(dir,{recursive:true,force:true});}
});
