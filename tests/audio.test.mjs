import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {openSync,closeSync} from 'node:fs';
const ffmpegPath=process.env.FFMPEG_PATH||path.resolve('vendor/ffmpeg.exe');
const dir=await mkdtemp(path.join(os.tmpdir(),'auralith-test-'));
const source=path.join(dir,'source.false');
const fixture=spawnSync(ffmpegPath,['-v','error','-f','lavfi','-i',"aevalsrc=if(gt(t\\,3)\\,0.3*sin(2*PI*900*t)\\,0):s=48000:d=4",'-c:a','pcm_s24le','-f','wav',source],{stdio:'inherit',windowsHide:true});
assert.equal(fixture.status,0,fixture.stderr?.toString());
const mod=await import('../desktop/audio.mjs').catch(()=>({}));
async function samples(file){const rawPath=path.join(dir,`read-${Math.random()}.raw`);const fd=openSync(rawPath,'w');const r=spawnSync(ffmpegPath,['-v','error','-i',file,'-ar','12000','-ac','2','-f','f32le','pipe:1'],{stdio:['ignore',fd,'inherit'],windowsHide:true});closeSync(fd);assert.equal(r.status,0);return readFile(rawPath);}
async function toneRatio(file){const raw=await samples(file);const power=hz=>{let s=0,c=0;for(let frame=6000;frame<54000;frame++){const sample=(raw.readFloatLE(frame*8)+raw.readFloatLE(frame*8+4))/2;s+=sample*Math.sin(2*Math.PI*hz*frame/12000);c+=sample*Math.cos(2*Math.PI*hz*frame/12000);}return s*s+c*c;};return 10*Math.log10(power(900)/power(1900));}
test('engine API exists',()=>assert.equal(typeof mod.createAudioEngine,'function'));
test('real rendering and input validation',async(t)=>{
 assert.equal(typeof mod.createAudioEngine,'function');
 const engine=mod.createAudioEngine({ffmpegPath,workDir:path.join(dir,'work')});
 const request={outputPath:path.join(dir,'out.wav'),duration:9,variant:'CLEAR',format:'wav',targetLufs:-18,background:{kind:'none',gainDb:-20},pulse:{enabled:false,hz:6,depth:0.2},layers:[{id:'one',path:source,gainDb:0,pan:0,speed:0.5,reverse:false,offset:0,muted:false,solo:false}]};
 await t.test('content detection and waveform',async()=>{const p=await engine.probe(source);assert.equal(p.bits,24);assert.ok(Math.abs(p.duration-4)<0.05);const w=await engine.waveform(source);assert.equal(w.length,160);assert.ok(Math.max(...w)>0.9);});
 await t.test('invalid numerical fields',async()=>{for(const duration of [NaN,Infinity,0,3601])await assert.rejects(engine.render({...request,duration}));await assert.rejects(engine.render({...request,layers:[{...request.layers[0],speed:NaN}]}));});
 await t.test('24-bit master and stretched end marker',async()=>{const r=await engine.render(request);assert.equal(r.metrics.bits,24);assert.equal(r.metrics.sampleRate,48000);assert.equal(r.metrics.channels,2);assert.ok(r.metrics.integratedLufs>-20&&r.metrics.integratedLufs<-16);assert.ok(r.metrics.truePeakDbtp<=-0.8);const bytes=await readFile(r.path);assert.equal(bytes.toString('ascii',0,4),'RIFF');const rawPath=path.join(dir,'decoded.raw');const fd=openSync(rawPath,'w');const decoded=spawnSync(ffmpegPath,['-v','error','-ss','6.3','-i',r.path,'-t','1','-f','f32le','-ac','1','pipe:1'],{stdio:['ignore',fd,'inherit'],windowsHide:true});closeSync(fd);assert.equal(decoded.status,0);const raw=await readFile(rawPath);let peak=0;for(let i=0;i<raw.length;i+=4)peak=Math.max(peak,Math.abs(raw.readFloatLE(i)));assert.ok(peak>0.01,'source end marker survives atempo 0.5');assert.ok(Math.abs((await engine.probe(r.path)).duration-9)<0.05);});
 await t.test('FLAC and MP3 actual exports',async()=>{for(const format of ['flac','mp3']){const r=await engine.render({...request,duration:5,format,outputPath:path.join(dir,'out.'+format),background:{kind:'pink',gainDb:-20},layers:[]});assert.ok(Number.isFinite(r.metrics.integratedLufs));assert.ok(r.metrics.truePeakDbtp<=-0.8);if(format==='flac')assert.equal(r.metrics.bits,24);}});
 await t.test('silent mix rejected; cancellation preserves output',async()=>{await assert.rejects(engine.render({...request,layers:[]}));const controller=new AbortController();await writeFile(request.outputPath,'original');const p=engine.render({...request,duration:3600,background:{kind:'brown',gainDb:-20}},{signal:controller.signal,onProgress:()=>controller.abort()});await assert.rejects(p,{name:'AbortError'});assert.equal(await readFile(request.outputPath,'utf8'),'original');});
 await t.test('running FFmpeg cancellation cleans own intermediates',async()=>{const controller=new AbortController();let scheduled=false;const p=engine.render({...request,duration:3600,layers:[],background:{kind:'brown',gainDb:-20}},{signal:controller.signal,onProgress:()=>{if(!scheduled){scheduled=true;setTimeout(()=>controller.abort(),70);}}});await assert.rejects(p,{name:'AbortError'});assert.equal(await readFile(request.outputPath,'utf8'),'original');assert.deepEqual(await readdir(path.join(dir,'work')),[]);});
 await t.test('CONTROL ignores missing voice files and pulse',async()=>{const base={...request,duration:5,variant:'CONTROL',background:{kind:'pink',gainDb:-20}};const first=await engine.render({...base,layers:[],outputPath:path.join(dir,'control1.wav')});const second=await engine.render({...base,layers:[{...request.layers[0],path:path.join(dir,'missing.wav')}],pulse:{enabled:true,hz:17,depth:0.5},outputPath:path.join(dir,'control2.wav')});assert.deepEqual(await readFile(first.path),await readFile(second.path));});
 await t.test('solo skips missing inactive source; hard left pan has silent right channel',async()=>{const r=await engine.render({...request,layers:[{...request.layers[0],solo:true,pan:-1},{...request.layers[0],id:'missing',path:path.join(dir,'missing.wav')} ]});const rawPath=path.join(dir,'stereo.raw');const fd=openSync(rawPath,'w');const result=spawnSync(ffmpegPath,['-v','error','-i',r.path,'-f','f32le','pipe:1'],{stdio:['ignore',fd,'inherit'],windowsHide:true});closeSync(fd);assert.equal(result.status,0);const raw=await readFile(rawPath);let left=0,right=0;for(let i=0;i<raw.length;i+=8){left+=raw.readFloatLE(i)**2;right+=raw.readFloatLE(i+4)**2;}assert.ok(left>1);assert.ok(right<left*1e-9);});
 await t.test('digital silence input rejected',async()=>{const silent=path.join(dir,'silent.wav');assert.equal(spawnSync(ffmpegPath,['-v','error','-f','lavfi','-i','anullsrc=r=48000:cl=mono','-t','1',silent],{stdio:'inherit',windowsHide:true}).status,0);await assert.rejects(engine.render({...request,layers:[{...request.layers[0],path:silent}]}));});
 await t.test('imported background loops without sample discontinuities',async()=>{const loop=path.join(dir,'loop.wav');assert.equal(spawnSync(ffmpegPath,['-v','error','-f','lavfi','-i','sine=frequency=123:sample_rate=48000:duration=0.311',loop],{stdio:'inherit',windowsHide:true}).status,0);const r=await engine.render({...request,duration:5,layers:[],background:{kind:'file',path:loop,gainDb:-10}});const rawPath=path.join(dir,'seam.raw');const fd=openSync(rawPath,'w');assert.equal(spawnSync(ffmpegPath,['-v','error','-i',r.path,'-ac','1','-f','f32le','pipe:1'],{stdio:['ignore',fd,'inherit'],windowsHide:true}).status,0);closeSync(fd);const raw=await readFile(rawPath);let max=0,jump=0;for(let i=4;i<raw.length;i+=4){const value=raw.readFloatLE(i);max=Math.max(max,Math.abs(value));jump=Math.max(jump,Math.abs(value-raw.readFloatLE(i-4)));}assert.ok(jump<max*0.08,`seam jump ${jump}, peak ${max}`);});
 await t.test('reverse and offset move the source end marker; muted files are ignored',async()=>{const r=await engine.render({...request,duration:5,layers:[{...request.layers[0],reverse:true,speed:1,offset:1},{...request.layers[0],muted:true,path:path.join(dir,'missing.wav')}]});const peaks=await engine.waveform(r.path);assert.ok(Math.max(...peaks.slice(0,25))<0.001);assert.ok(Math.max(...peaks.slice(36,55))>0.5);assert.ok(Math.max(...peaks.slice(80,120))<0.01);});
 await t.test('MP3 MPEG frame headers specify 320kbps CBR',async()=>{const bytes=await readFile(path.join(dir,'out.mp3'));const rates=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320];let frames=0;for(let i=0;i<bytes.length-4;i++){if(bytes[i]!==255||(bytes[i+1]&0xfe)!==0xfa)continue;const bitrate=rates[bytes[i+2]>>4],sampleRate=[44100,48000,32000][(bytes[i+2]>>2)&3];if(!bitrate||!sampleRate)continue;assert.equal(bitrate,320);frames++;i+=Math.floor(144000*bitrate/sampleRate)+((bytes[i+2]>>1)&1)-1;}assert.ok(frames>100);});
 await t.test('pulse never modulates a voice-only mix',async()=>{const base={...request,duration:5,layers:[{...request.layers[0],speed:1}]};const a=await engine.render({...base,outputPath:path.join(dir,'pulseoff.wav')});const b=await engine.render({...base,pulse:{enabled:true,hz:7,depth:0.5},outputPath:path.join(dir,'pulseon.wav')});assert.ok((await readFile(a.path)).equals(await readFile(b.path)),'voice output changes with pulse');});
 await t.test('voice/background gains alter exported tone ratio and measured pre-master ratio',async()=>{const voice=path.join(dir,'voice-tone.wav'),background=path.join(dir,'background-tone.wav');for(const [file,hz] of [[voice,900],[background,1900]])assert.equal(spawnSync(ffmpegPath,['-v','error','-f','lavfi','-i',`sine=frequency=${hz}:sample_rate=48000:duration=5`,file],{stdio:'inherit',windowsHide:true}).status,0);const base={...request,duration:5,background:{kind:'file',path:background,gainDb:-18},layers:[{...request.layers[0],path:voice,speed:1}]};const normal=await engine.render({...base,outputPath:path.join(dir,'gain-normal.wav')});const voiceDown=await engine.render({...base,layers:[{...base.layers[0],gainDb:-6}],outputPath:path.join(dir,'gain-voice.wav')});const backgroundDown=await engine.render({...base,background:{...base.background,gainDb:-24},outputPath:path.join(dir,'gain-background.wav')});const normalRatio=await toneRatio(normal.path);assert.ok(Math.abs((await toneRatio(voiceDown.path))-normalRatio+6)<0.7);assert.ok(Math.abs((await toneRatio(backgroundDown.path))-normalRatio-6)<0.7);assert.ok(Math.abs(voiceDown.metrics.voiceBackgroundDb-normal.metrics.voiceBackgroundDb+6)<0.3);assert.ok(Math.abs(backgroundDown.metrics.voiceBackgroundDb-normal.metrics.voiceBackgroundDb-6)<0.3);});
 await t.test('measured stereo QC: mono correlation +1 and hard pan undefined with 3dB loss',async()=>{const mono=await engine.render({...request,duration:5,layers:[{...request.layers[0],speed:1}]});assert.ok(mono.metrics.correlation>0.99999);assert.ok(Math.abs(mono.metrics.monoLossDb)<0.001);const hard=await engine.render({...request,duration:5,layers:[{...request.layers[0],pan:-1,speed:1}]});assert.equal(hard.metrics.correlation,null);assert.ok(Math.abs(hard.metrics.monoLossDb-3.0103)<0.01);});
});
test.after(()=>rm(dir,{recursive:true,force:true}));



// Regressions use real media and final decoded samples, not FFmpeg argument mocks.
test('MediaRecorder-style WebM without Duration is measured and rendered',async()=>{
 const recording=path.join(dir,'recording.webm');
 assert.equal(spawnSync(ffmpegPath,['-v','error','-f','lavfi','-i','sine=frequency=700:sample_rate=48000:duration=2','-c:a','libopus','-live','1',recording],{stdio:'inherit',windowsHide:true}).status,0);
 const metadata=spawnSync(ffmpegPath,['-hide_banner','-i',recording,'-t','0.01','-f','null','-'],{encoding:'utf8',windowsHide:true});
 assert.match(metadata.stderr,/Duration: N\/A/);
 const engine=mod.createAudioEngine({ffmpegPath,workDir:path.join(dir,'webm-work')});
 const info=await engine.probe(recording);assert.ok(Math.abs(info.duration-2)<0.03);
 assert.equal((await engine.waveform(recording)).length,160);
 const result=await engine.render({outputPath:path.join(dir,'recorded.wav'),duration:5,variant:'CLEAR',format:'wav',targetLufs:-18,background:{kind:'none',gainDb:-20},pulse:{enabled:false,hz:6,depth:0.2},layers:[{path:recording,gainDb:0,pan:0,speed:1,reverse:false,offset:0,muted:false,solo:false}]});
 assert.ok(Number.isFinite(result.metrics.integratedLufs));
});
test('master fade follows min(2 seconds, duration/8) in actual exports',async()=>{
 const tone=path.join(dir,'fade-tone.wav');
 assert.equal(spawnSync(ffmpegPath,['-v','error','-f','lavfi','-i','sine=frequency=1000:sample_rate=48000:duration=25',tone],{stdio:'inherit',windowsHide:true}).status,0);
 const engine=mod.createAudioEngine({ffmpegPath,workDir:path.join(dir,'fade-work')});
 for(const duration of [5,20]){
  const result=await engine.render({outputPath:path.join(dir,`fade-${duration}.wav`),duration,variant:'CONTROL',format:'wav',targetLufs:-18,background:{kind:'file',path:tone,gainDb:-18},pulse:{enabled:false,hz:6,depth:0.2},layers:[]});
  const raw=await samples(result.path),fade=Math.min(2,duration/8);
  const rms=time=>{let sum=0;const start=Math.round((time-0.015)*12000),end=Math.round((time+0.015)*12000);for(let i=start;i<end;i++)sum+=raw.readFloatLE(i*8)**2;return Math.sqrt(sum/(end-start));};
  const middle=rms(duration/2);
  for(const fraction of [0.25,0.5,0.75]){
   assert.ok(Math.abs(rms(fade*fraction)/middle-fraction)<0.06,`fade in ${duration}s at ${fraction}: ${rms(fade*fraction)/middle}`);
   assert.ok(Math.abs(rms(duration-fade*fraction)/middle-fraction)<0.06,`fade out ${duration}s at ${fraction}`);
  }
 }
});

test('import duration cap and active-source cap remain distinct',async()=>{
 const engine=mod.createAudioEngine({ffmpegPath,workDir:path.join(dir,'limits-work')});
 const long=path.join(dir,'601.wav');
 assert.equal(spawnSync(ffmpegPath,['-v','error','-f','lavfi','-i','anullsrc=r=8000:cl=mono','-t','601',long],{stdio:'inherit',windowsHide:true}).status,0);
 assert.equal((await engine.probe(long)).duration,601);
 const request={outputPath:path.join(dir,'too-long.wav'),duration:5,variant:'CLEAR',format:'wav',targetLufs:-18,background:{kind:'none',gainDb:-20},pulse:{enabled:false,hz:6,depth:0.2},layers:[{path:long,gainDb:0,pan:0,speed:1,reverse:true,offset:0,muted:false,solo:false}]};
 await assert.rejects(engine.render(request),/10 minut.*limit pamięci odwracania/);
 await assert.rejects(engine.render({...request,layers:[],background:{kind:'file',path:long,gainDb:-20}}),/10 minut/);
 const recording=path.join(dir,'overlong.webm'),seed=path.join(dir,'limit-seed.webm');
 assert.equal(spawnSync(ffmpegPath,['-v','error','-f','lavfi','-i','anullsrc=r=8000:cl=mono','-t','1','-c:a','libopus',seed],{stdio:'inherit',windowsHide:true}).status,0);
 assert.equal(spawnSync(ffmpegPath,['-v','error','-stream_loop','-1','-i',seed,'-t','3602','-c:a','copy','-live','1',recording],{stdio:'inherit',windowsHide:true}).status,0);
 await assert.rejects(engine.probe(recording),/60 minut/);
 await assert.rejects(engine.probe('https://example.invalid/live.webm'));
 await assert.rejects(engine.probe(dir),/lokalnym plikiem/);
});
