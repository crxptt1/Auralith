import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createAudioEngine} from '../desktop/audio.mjs';

const ffmpegPath=process.env.FFMPEG_PATH||path.resolve('vendor/ffmpeg.exe');
const dir=await mkdtemp(path.join(os.tmpdir(),'auralith-ultrasonic-'));
const source=path.join(dir,'voice.wav');
assert.equal(spawnSync(ffmpegPath,['-v','error','-f','lavfi','-i','sine=frequency=1000:sample_rate=48000:duration=5','-c:a','pcm_s24le',source],{windowsHide:true}).status,0);
const engine=createAudioEngine({ffmpegPath,workDir:path.join(dir,'work')});
const request={duration:5,targetLufs:-24,format:'wav',background:{kind:'none',gainDb:-18},pulse:{enabled:false,hz:6,depth:.2},layers:[{path:source,gainDb:0,pan:0,speed:1,reverse:false,offset:0,muted:false,solo:false}]};
function decode(file,rate){const p=spawnSync(ffmpegPath,['-v','error','-ss','2','-i',file,'-t','1','-ar',String(rate),'-ac','1','-f','f32le','pipe:1'],{windowsHide:true,maxBuffer:4e6});assert.equal(p.status,0,p.stderr?.toString());return new Float32Array(p.stdout.buffer.slice(p.stdout.byteOffset,p.stdout.byteOffset+p.stdout.byteLength));}
function amplitude(samples,hz,rate){let s=0,c=0;for(let n=0;n<samples.length;n++){s+=samples[n]*Math.sin(2*Math.PI*hz*n/rate);c+=samples[n]*Math.cos(2*Math.PI*hz*n/rate);}return 2*Math.hypot(s,c)/samples.length;}
for(const [variant,rate,carrier] of [['ULTRASONIC',96000,25000],['NEAR',48000,20000]]){
 test(`${variant} exports modulated speech, not an empty carrier or audible source`,async()=>{
  for(const format of ['wav','flac']){
   const result=await engine.render({...request,variant,format,outputPath:path.join(dir,`${variant}.${format}`)});
   assert.equal(result.metrics.sampleRate,rate);assert.equal(result.metrics.bits,24);
   assert.ok(result.metrics.truePeakDbtp<=-23.5);assert.ok(result.metrics.correlation>.999);
   const samples=decode(result.path,rate),lo=amplitude(samples,carrier-1000,rate),hi=amplitude(samples,carrier+1000,rate);
   assert.ok(lo>.005&&hi>.005,`sidebands missing: ${lo}, ${hi}`);
   assert.ok(Math.abs(20*Math.log10(lo/hi))<1);
   assert.ok(amplitude(samples,1000,rate)<hi*.001,'audible speech leaked');
   assert.ok(amplitude(samples,carrier,rate)<hi*.001,'unmodulated carrier leaked');
   assert.equal(result.metrics.voiceBackgroundDb,null);
   assert.ok(result.checks.some(c=>c.label==='Modulacja wysokoczęstotliwościowa'));
   assert.ok(!result.checks.some(c=>c.status==='fail'));
  }
 });
 test(`${variant} rejects lossy output before touching destination`,async()=>{
  const outputPath=path.join(dir,`${variant}.mp3`);await writeFile(outputPath,'original');
  await assert.rejects(engine.render({...request,variant,format:'mp3',outputPath}),/WAV.*FLAC/);
  assert.equal(await readFile(outputPath,'utf8'),'original');
 });
}
test('near mode keeps gains, never boosts for LUFS, and removes out-of-band source before modulation',async()=>{
 const mixed=path.join(dir,'wide.wav');
 assert.equal(spawnSync(ffmpegPath,['-v','error','-f','lavfi','-i','aevalsrc=0.1*sin(2*PI*1000*t)+0.1*sin(2*PI*7000*t):s=48000:d=5',mixed],{windowsHide:true}).status,0);
 const base={...request,variant:'NEAR',layers:[{...request.layers[0],path:mixed}]};
 const a=await engine.render({...base,outputPath:path.join(dir,'near-base.wav')});
 const b=await engine.render({...base,targetLufs:-14,outputPath:path.join(dir,'near-lufs.wav')});
 assert.deepEqual(await readFile(a.path),await readFile(b.path));
 const quieter=await engine.render({...base,layers:[{...base.layers[0],gainDb:-6}],outputPath:path.join(dir,'near-down.wav')});
 const sa=decode(a.path,48000),sb=decode(quieter.path,48000);
 assert.ok(Math.abs(20*Math.log10(amplitude(sb,21000,48000)/amplitude(sa,21000,48000))+6)<.2);
 assert.ok(amplitude(sa,13000,48000)<amplitude(sa,21000,48000)*.001,'out-of-band lower sideband');
 assert.ok(amplitude(sa,21000,48000)>.005);
});
test('ultrasonic background mix has attenuation-only ceiling and cancellation cleans intermediates',async()=>{
 const base={...request,variant:'ULTRASONIC',background:{kind:'pink',gainDb:0},outputPath:path.join(dir,'background.wav')};
 const result=await engine.render(base);assert.ok(result.metrics.truePeakDbtp<=-5.8);assert.equal(result.metrics.sampleRate,96000);
 const controller=new AbortController();await assert.rejects(engine.render({...base,duration:60},{signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});
 assert.deepEqual(await readdir(path.join(dir,'work')),[]);
});
test('filter rejection is not normalized back up for high-only input',async()=>{
 const file=path.join(dir,'rejected.wav');assert.equal(spawnSync(ffmpegPath,['-v','error','-f','lavfi','-i','sine=frequency=7000:sample_rate=48000:duration=5',file],{windowsHide:true}).status,0);
 // A background allows the render to remain measurable after rejected speech quantizes to silence.
 const result=await engine.render({...request,variant:'NEAR',layers:[{...request.layers[0],path:file}],background:{kind:'brown',gainDb:-30},outputPath:path.join(dir,'rejected-out.wav')});
 const samples=decode(result.path,48000);
 assert.ok(amplitude(samples,13000,48000)<.00001,'rejected 7 kHz source was boosted');
});
test('quiet speech is never boosted to the vocal ceiling',async()=>{
 const file=path.join(dir,'quiet.wav');assert.equal(spawnSync(ffmpegPath,['-v','error','-f','lavfi','-i','aevalsrc=0.001*sin(2*PI*1000*t):s=48000:d=5','-c:a','pcm_s24le',file],{windowsHide:true}).status,0);
 const result=await engine.render({...request,variant:'NEAR',layers:[{...request.layers[0],path:file}],outputPath:path.join(dir,'quiet-out.wav')});
 assert.ok(result.metrics.truePeakDbtp<-59,`quiet source boosted to ${result.metrics.truePeakDbtp} dBTP`);
});
test('rejected quiet voices never bypass modulation into the audible mix',async()=>{
 const file=path.join(dir,'quiet-rejected.wav');assert.equal(spawnSync(ffmpegPath,['-v','error','-f','lavfi','-i','sine=frequency=7000:sample_rate=48000:duration=5',file],{windowsHide:true}).status,0);
 const base={...request,variant:'NEAR',background:{kind:'brown',gainDb:-30,lowpassHz:1000}};
 const a=await engine.render({...base,layers:[{...request.layers[0],path:file,gainDb:-60}],outputPath:path.join(dir,'quiet-rejected-out.wav')});
 const b=await engine.render({...base,layers:[],outputPath:path.join(dir,'background-only.wav')});
 assert.ok((await readFile(a.path)).equals(await readFile(b.path)),'a rejected voice should not enter the mix unmodulated');
});
test.after(()=>rm(dir,{recursive:true,force:true}));
