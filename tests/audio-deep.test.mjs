import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {createAudioEngine} from '../desktop/audio.mjs';
const dir=await mkdtemp(path.join(os.tmpdir(),'auralith-deep-'));
const ffmpegPath=process.env.FFMPEG_PATH||path.resolve('vendor/ffmpeg.exe');
const ff=args=>{const r=spawnSync(ffmpegPath,['-v','error','-y',...args],{windowsHide:true,encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
const voice=path.join(dir,'voice.wav'),bg=path.join(dir,'bg.wav'),silent=path.join(dir,'silence.wav');
ff(['-f','lavfi','-i','sine=frequency=900:sample_rate=48000:duration=12',voice]);
ff(['-f','lavfi','-i',"anoisesrc=color=pink:seed=512:sample_rate=48000:duration=12",'-af',"volume='if(lt(t,3),0.02,if(lt(t,6),0.8,if(lt(t,9),0.008,0)))':eval=frame",bg]);
ff(['-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t','5',silent]);
const engine=createAudioEngine({ffmpegPath,workDir:path.join(dir,'work')});
const base={outputPath:path.join(dir,'deep.wav'),duration:12,variant:'DEEP',format:'wav',targetLufs:-30,background:{kind:'file',path:bg,gainDb:-18},pulse:{enabled:false,hz:6,depth:0.2},layers:[{path:voice,gainDb:0,pan:0,speed:1,reverse:false,offset:0,muted:false,solo:false}]};
async function pcm(file){const raw=path.join(dir,`pcm-${Math.random()}.raw`);ff(['-i',file,'-ac','2','-ar','12000','-f','f32le',raw]);return readFile(raw);}
function energy(raw,start,end,channel=0){let sum=0;for(let i=Math.round(start*12000);i<end*12000;i++)sum+=raw.readFloatLE(i*8+channel*4)**2;return sum/((end-start)*12000);}
function tone(raw,start,end,hz){let s=0,c=0;const first=Math.round(start*12000),last=Math.round(end*12000);for(let i=first;i<last;i++){const v=raw.readFloatLE(i*8);s+=v*Math.sin(2*Math.PI*hz*i/12000);c+=v*Math.cos(2*Math.PI*hz*i/12000);}return 2*Math.hypot(s,c)/(last-first);}
test('DEEP renders quiet intro and abrupt drop with measurable dynamic attenuation',async()=>{
 const result=await engine.render(base);assert.ok(Math.abs(result.metrics.integratedLufs+30)<1);
 assert.ok(result.metrics.deepMask,'reports applied dynamic attenuation');
 assert.ok(result.metrics.deepMask.minGainDb===null||result.metrics.deepMask.minGainDb<result.metrics.deepMask.maxGainDb-20);
 assert.ok(result.metrics.deepMask.silentWindows>50);
 assert.equal(result.metrics.deepMask.windowMs,20);
 const raw=await pcm(result.path);assert.ok(energy(raw,1,2)<energy(raw,4,5)*0.01);assert.ok(energy(raw,7,8)<energy(raw,4,5)*0.001);assert.ok(energy(raw,10,10.5)<1e-12,'voice silent with silent background');
});
test('DEEP rejects absent, muted and silent background',async()=>{for(const background of [{kind:'none',gainDb:-18},{...base.background,muted:true},{...base.background,path:silent}])await assert.rejects(engine.render({...base,background}),/Deep Mask.*tł/i);});
test('background solo ignores missing voice; pan and lower loudness are applied',async()=>{
 const result=await engine.render({...base,variant:'CLEAR',targetLufs:-36,background:{kind:'pink',gainDb:-18,solo:true,pan:-1},layers:[{...base.layers[0],path:path.join(dir,'missing.wav')}]});
 const raw=await pcm(result.path);assert.ok(energy(raw,4,5)>1e-7);assert.ok(energy(raw,4,5,1)<1e-15);assert.ok(Math.abs(result.metrics.integratedLufs+36)<1);
});
test('advanced background values validated',async()=>{for(const patch of [{speed:0.1},{pan:2},{fadeIn:-1},{fadeOut:Infinity},{highpassHz:NaN},{lowpassHz:20},{highpassHz:4000,lowpassHz:500},{muted:'yes'},{solo:1},{reverse:1}])await assert.rejects(engine.render({...base,background:{...base.background,...patch}}),/Nieprawidł/);});
test('DEEP cancellation during analysis preserves destination and cleans disk intermediates',async()=>{
 const outputPath=path.join(dir,'cancel.wav');await writeFile(outputPath,'keep');const controller=new AbortController();
 await assert.rejects(engine.render({...base,outputPath},{signal:controller.signal,onProgress:({stage})=>{if(stage.includes('Deep Mask'))setTimeout(()=>controller.abort(),30);}}),{name:'AbortError'});
 assert.equal(await readFile(outputPath,'utf8'),'keep');assert.deepEqual(await readdir(path.join(dir,'work')),[]);
});
test('background solo DEEP reports no processed voices',async()=>{
 const result=await engine.render({...base,background:{...base.background,solo:true}});
 assert.equal(result.metrics.deepMask,undefined);assert.match(result.checks.find(c=>c.label==='Poziom głosu').detail,/Brak aktywnych głosów/);
});
test('actual exported voice follows background drop; MASKED remains static; DEEP honors sliders',async()=>{
 const music=path.join(dir,'multitone.wav');
 ff(['-f','lavfi','-i',"aevalsrc=(sin(2*PI*600*t)+sin(2*PI*1800*t)+sin(2*PI*3200*t))*if(lt(t\\,3)\\,0.003\\,if(lt(t\\,6)\\,0.1\\,0.001)):s=48000:d=12",music]);
 const request={...base,background:{...base.background,path:music}};
 const deep=await engine.render(request),d=await pcm(deep.path);
 const masked=await engine.render({...request,variant:'MASKED'}),m=await pcm(masked.path);
 const difference=raw=>20*Math.log10(tone(raw,7,8,900)/tone(raw,4,5,900));
 assert.ok(difference(d)<-30,`DEEP voice drop ${difference(d)} dB`);
 assert.ok(Math.abs(difference(m))<1,`MASKED voice remains static ${difference(m)} dB`);
 const down=await engine.render({...request,layers:[{...base.layers[0],gainDb:-45}]}),v=await pcm(down.path);
 assert.ok(tone(v,4,5,900)<tone(d,4,5,900)*0.1,'voice gain remains effective below dynamic cap');
 const bedDown=await engine.render({...request,background:{...request.background,gainDb:-30},pulse:{enabled:true,hz:6,depth:0.5}});
 const bd=await pcm(bedDown.path);
 assert.ok(20*Math.log10(tone(bd,7,8,900)/tone(bd,7,8,600))<-25,'lower bed plus pulse never exposes voice');
});
test('background processing: mute, reverse, tempo, filter and fades affect decoded export',async()=>{
 const marker=path.join(dir,'marker.wav');ff(['-f','lavfi','-i',"aevalsrc=if(gt(t\\,3)\\,0.2*sin(2*PI*900*t)\\,0):s=48000:d=4",marker]);
 const request={...base,duration:8,variant:'CONTROL',layers:[],background:{kind:'file',path:marker,gainDb:-18}};
 const stretched=await pcm((await engine.render({...request,background:{...request.background,speed:0.5}})).path);
 assert.ok(energy(stretched,2,3)<1e-12);assert.ok(energy(stretched,6.3,6.8)>1e-5);
 const reverse=await pcm((await engine.render({...request,background:{...request.background,reverse:true}})).path);
 assert.ok(energy(reverse,.3,.7)>1e-5);assert.ok(energy(reverse,2,3)<1e-12);
 const muted=await engine.render({...base,variant:'CLEAR',background:{...base.background,path:path.join(dir,'missing.wav'),muted:true}});
 assert.ok(Number.isFinite(muted.metrics.integratedLufs));
 const shaped=await pcm((await engine.render({...base,variant:'CONTROL',layers:[],background:{kind:'pink',gainDb:-18,highpassHz:1000,lowpassHz:2000,fadeIn:4,fadeOut:4}})).path);
 const normal=await pcm((await engine.render({...base,variant:'CONTROL',layers:[],background:{kind:'pink',gainDb:-18}})).path);
 assert.ok(energy(shaped,1,1.3)/energy(shaped,5,5.3)<energy(normal,1,1.3)/energy(normal,5,5.3)*0.2,'four-second background fade applies');
 // Distinct spectral change, normalized to 1800 Hz to eliminate master gain.
 assert.ok(tone(shaped,4,8,600)/tone(shaped,4,8,1800)<tone(normal,4,8,600)/tone(normal,4,8,1800)*0.7);
});
test.after(()=>rm(dir,{recursive:true,force:true}));
