import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,rm,rename,stat} from 'node:fs/promises';
import path from 'node:path';
import {openSync,closeSync,createReadStream} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {applyDeepMask} from './deepmask.mjs';

const abortError=()=>Object.assign(new Error('Renderowanie anulowane.'),{name:'AbortError'});
const finite=(value,min,max,label)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`Nieprawidłowa wartość: ${label}.`);};
const number=value=>Number.isFinite(Number(value))?Number(value):null;
const loudness=text=>{const matches=[...text.matchAll(/\{\s*"input_i"[\s\S]*?\}/g)];if(!matches.length)throw new Error('FFmpeg nie zwrócił pomiaru głośności.');return JSON.parse(matches.at(-1)[0]);};

export function createAudioEngine({ffmpegPath,workDir}) {
 if(!ffmpegPath||!workDir)throw new Error('Brak ścieżki FFmpeg lub katalogu roboczego.');
 async function run(args,{signal,onData}={}) {
  if(signal?.aborted)throw abortError();
  await mkdir(workDir,{recursive:true});
  const logs=await mkdtemp(path.join(workDir,'ffmpeg-'));
  const outPath=path.join(logs,'stdout'),errPath=path.join(logs,'stderr');
  const out=openSync(outPath,'w'),err=openSync(errPath,'w');
  try {
  await new Promise((resolve,reject)=>{
   const child=spawn(ffmpegPath,['-hide_banner','-nostdin','-nostats',...args],{windowsHide:true,shell:false,stdio:['ignore',out,err]});
   let settled=false;
   const abort=()=>child.kill();
   signal?.addEventListener('abort',abort,{once:true});
   const finish=(error)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);if(signal?.aborted)reject(abortError());else if(error)reject(error);else resolve();};
   child.once('error',finish);
   child.once('close',async code=>finish(code===0?null:new Error(`FFmpeg: ${(await readFile(errPath,'utf8')).slice(-3500)||`kod ${code}`}`)));
   if(signal?.aborted)abort();
  });
  if(onData)for await(const data of createReadStream(outPath))onData(data);
  return (await readFile(errPath,'utf8')).slice(-262144);
  }finally{closeSync(out);closeSync(err);await rm(logs,{recursive:true,force:true}).catch(()=>{});}
 }
 async function probeInternal(file,signal) {
  if(typeof file!=='string'||!file.trim())throw new Error('Brak pliku audio.');
  if(!(await stat(file)).isFile())throw new Error('Źródło audio musi być lokalnym plikiem.');
  const log=await run(['-protocol_whitelist','file','-i',file,'-map','0:a:0','-t','0.01','-f','null','-'],{signal});
  const input=log.split('Output #')[0];
  const durationMatch=input.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const audio=input.match(/Audio:\s*([^\r\n]+)/)?.[1];
  if(!audio)throw new Error('Nie można odczytać strumienia audio.');
  let duration=durationMatch?+durationMatch[1]*3600 + +durationMatch[2]*60 + +durationMatch[3]:null;
  if(duration===null){
   // MediaRecorder WebM omits Duration. Fully decode, capped at 3601 s.
   // Read decoded output timestamps so packet gaps still count toward duration.
   // Local regular files and file-only protocols exclude network and live inputs.
   let progress='';
   await run(['-v','error','-protocol_whitelist','file','-i',file,'-map','0:a:0','-t','3601','-progress','pipe:1','-f','null','-'],{signal,onData:chunk=>{progress+=chunk.toString();}});
   duration=Number([...progress.matchAll(/out_time_us=(\d+)/g)].at(-1)?.[1])/1e6;
  }
  if(duration>3600)throw new Error('Importowany plik audio może mieć maksymalnie 60 minut.');
  const sampleRate=Number(audio.match(/(\d+) Hz/)?.[1]);
  const channels=/\bstereo\b/.test(audio)?2:/\bmono\b/.test(audio)?1:Number(audio.match(/(\d+) channels/)?.[1])||(/5\.1/.test(audio)?6:/7\.1/.test(audio)?8:0);
  const bits=Number(audio.match(/\((\d+) bit\)/)?.[1]||audio.match(/pcm_[su](\d+)/)?.[1]||audio.match(/\bs(16|32)\b/)?.[1]||0);
  if(!(duration>0)||!sampleRate||!channels)throw new Error('Nieobsługiwane metadane audio.');
  return {duration,sampleRate,channels,format:input.match(/Input #0, (.*?), from/)?.[1]||audio.split(',')[0],bits};
 }
 async function waveform(file) {
  const info=await probeInternal(file);
  // Streaming downsample: memory remains constant even for long imports.
  const peaks=Array(160).fill(0);let frame=0;let carry=Buffer.alloc(0);
  await run(['-v','error','-i',file,'-map','0:a:0','-ac','1','-ar','2000','-f','f32le','pipe:1'],{onData:chunk=>{
   const bytes=Buffer.concat([carry,chunk]);const end=bytes.length-bytes.length%4;
   for(let i=0;i<end;i+=4){const index=Math.min(159,Math.floor(frame++/(info.duration*2000)*160));peaks[index]=Math.max(peaks[index],Math.abs(bytes.readFloatLE(i)));}
   carry=bytes.subarray(end);
  }});
  const max=Math.max(...peaks);return max?peaks.map(p=>p/max):peaks;
 }
 async function stereoQc(file,signal){
  let count=0,sumL=0,sumR=0,sumLL=0,sumRR=0,sumLR=0,carry=Buffer.alloc(0);
  await run(['-v','error','-i',file,'-map','0:a:0','-ac','2','-ar','12000','-f','f32le','pipe:1'],{signal,onData:chunk=>{
   if(signal?.aborted)throw abortError();
   const data=Buffer.concat([carry,chunk]),end=data.length-data.length%8;
   for(let i=0;i<end;i+=8){const l=data.readFloatLE(i),r=data.readFloatLE(i+4);count++;sumL+=l;sumR+=r;sumLL+=l*l;sumRR+=r*r;sumLR+=l*r;}
   carry=data.subarray(end);
  }});
  const varL=count?Math.max(0,sumLL-sumL*sumL/count):0,varR=count?Math.max(0,sumRR-sumR*sumR/count):0;
  const reference=(sumLL+sumRR)/2,mono=Math.max(0,(sumLL+sumRR+2*sumLR)/4);
  // A silent channel has no defined Pearson correlation; never pretend it is zero.
  const correlation=varL>reference*1e-12&&varR>reference*1e-12?Math.max(-1,Math.min(1,(sumLR-sumL*sumR/count)/Math.sqrt(varL*varR))):null;
  const monoLossDb=reference>0&&mono>reference*1e-12?Math.max(0,-10*Math.log10(mono/reference)):null;
  return {correlation,monoLossDb,monoCancelled:reference>0&&mono<=reference*1e-12};
 }
 function validate(r) {
  if(!r||typeof r.outputPath!=='string'||!r.outputPath.trim())throw new Error('Brak ścieżki eksportu.');
  finite(r.duration,5,3600,'czas');finite(r.targetLufs,-36,-14,'LUFS');
  if(!['CLEAR','LOW','MASKED','DEEP','CONTROL'].includes(r.variant)||!['wav','flac','mp3'].includes(r.format))throw new Error('Nieobsługiwany wariant lub format.');
  if(!r.background||!['none','brown','pink','file'].includes(r.background.kind))throw new Error('Nieprawidłowe tło.');
  finite(r.background.gainDb,-60,0,'wzmocnienie tła');
  for(const key of ['muted','solo','reverse'])if(r.background[key]!==undefined&&typeof r.background[key]!=='boolean')throw new Error(`Nieprawidłowe pole tła ${key}.`);
  for(const [key,min,max] of [['highpassHz',20,2000],['lowpassHz',1000,20000],['fadeIn',0,10],['fadeOut',0,10],['pan',-1,1],['speed',0.5,2]])if(r.background[key]!==undefined)finite(r.background[key],min,max,key);
  if((r.background.highpassHz??55)>=(r.background.lowpassHz??10000))throw new Error('Nieprawidłowe pasmo tła.');
  if(r.background.kind==='file'&&(typeof r.background.path!=='string'||!r.background.path.trim()))throw new Error('Brak pliku tła.');
  if(!r.pulse||typeof r.pulse.enabled!=='boolean')throw new Error('Nieprawidłowa modulacja.');
  finite(r.pulse.hz,1,30,'częstotliwość');finite(r.pulse.depth,0,0.5,'głębokość');
  if(!Array.isArray(r.layers)||r.layers.length>32)throw new Error('Maksymalnie 32 warstwy.');
  for(const l of r.layers){if(!l||typeof l.path!=='string'||!l.path.trim())throw new Error('Brak pliku warstwy.');finite(l.gainDb,-60,12,'wzmocnienie');finite(l.pan,-1,1,'panorama');finite(l.speed,0.5,2,'tempo');finite(l.offset,0,r.duration,'przesunięcie');for(const key of ['reverse','muted','solo'])if(typeof l[key]!=='boolean')throw new Error(`Nieprawidłowe pole ${key}.`);}
 }
 async function render(r,{signal,onProgress}={}) {
  validate(r);if(signal?.aborted)throw abortError();
  r={...r,background:{muted:false,solo:false,highpassHz:55,lowpassHz:10000,fadeIn:0.015,fadeOut:0.025,pan:0,speed:1,reverse:false,...r.background}};
  if(r.background.muted)r.background.kind='none';
  if(r.variant==='DEEP'&&r.background.kind==='none')throw new Error('Deep Mask wymaga mierzalnego, niewyciszonego tła.');
  const emit=(stage,progress)=>{onProgress?.({stage,progress});if(signal?.aborted)throw abortError();};
  const solos=r.layers.some(l=>l.solo&&!l.muted);
  const layers=r.variant==='CONTROL'||r.background.solo&&!r.background.muted&&r.background.kind!=='none'?[]:r.layers.filter(l=>!l.muted&&(!solos||l.solo)&&l.offset<r.duration);
  if(!layers.length&&r.background.kind==='none')throw new Error('Miks nie zawiera dźwięku.');
  await mkdir(workDir,{recursive:true});
  const job=await mkdtemp(path.join(workDir,'render-'));
  let temporary;
  const pcm=['-ar','48000','-ac','2','-c:a','pcm_f32le'];
  const edge=duration=>`afade=t=in:d=0.015,afade=t=out:st=${Math.max(0,duration-0.025)}:d=0.025`;
  const exec=args=>run(['-y',...args],{signal});
  const loopFile=async(file,name)=>{
   const info=await probeInternal(file,signal);
   const result=path.join(job,name);
   if(info.duration<0.1)throw new Error('Zapętlane źródło musi mieć co najmniej 0,1 sekundy.');
   // One overlap join and a faded cycle boundary; no unbounded JS sample buffers.
   await exec(['-i',file,'-filter_complex',`[0:a]asplit=2[a][b];[a][b]acrossfade=d=0.02:c1=tri:c2=tri,afade=t=in:d=0.015,afade=t=out:st=${Math.max(0,2*info.duration-0.075)}:d=0.04[out]`,'-map','[out]',...pcm,result]);
   return result;
  };
  const measure=async(file,band=false)=>{
   const log=await exec(['-i',file,'-af',`${band?'highpass=f=300,lowpass=f=4000,':''}volumedetect`,'-f','null','-']);
   return number(log.match(/mean_volume:\s*(-?[\d.]+|-inf) dB/)?.[1]);
  };
  try {
   emit('Przygotowanie źródeł',0.02);
   const prepared=[];
   for(let index=0;index<layers.length;index++){
    const layer=layers[index];const info=await probeInternal(layer.path,signal);
    // Disk preprocessing preserves the entire stretched input, with explicit bounded reverse memory.
    if(info.duration>600)throw new Error('Aktywny plik warstwy może mieć maksymalnie 10 minut (limit pamięci odwracania). Import obsługuje do 60 minut; podziel dłuższy materiał przed renderowaniem.');
    const duration=info.duration/layer.speed;const file=path.join(job,`stem-${index}.wav`);
    const left=Math.cos((layer.pan+1)*Math.PI/4),right=Math.sin((layer.pan+1)*Math.PI/4);
    await exec(['-i',layer.path,'-map','0:a:0','-af',`aformat=channel_layouts=mono,highpass=f=80,acompressor=threshold=0.125:ratio=2:attack=10:release=100,atempo=${layer.speed}${layer.reverse?',areverse':''},${edge(duration)},pan=stereo|c0=${left}*c0|c1=${right}*c0`,...pcm,file]);
    prepared.push({file:await loopFile(file,`loop-${index}.wav`),offset:layer.offset,gainDb:layer.gainDb});emit('Przygotowanie warstw',0.05+0.25*(index+1)/Math.max(1,layers.length));
   }
   let backgroundFile,backgroundNominal;
   if(r.background.kind!=='none'){
    backgroundFile=path.join(job,'background.wav');
    let input;
    if(r.background.kind==='file'){
     const info=await probeInternal(r.background.path,signal);
     if(info.duration>600)throw new Error('Aktywny plik tła może mieć maksymalnie 10 minut. Import obsługuje do 60 minut; podziel dłuższy materiał przed renderowaniem.');
     const backgroundSource=path.join(job,'background-source.wav');
     await exec(['-i',r.background.path,'-map','0:a:0','-af',`atempo=${r.background.speed}${r.background.reverse?',areverse':''},${edge(info.duration/r.background.speed)}`,...pcm,backgroundSource]);
     input=['-stream_loop','-1','-i',await loopFile(backgroundSource,'background-loop.wav')];
    }
    else input=['-f','lavfi','-i',`anoisesrc=color=${r.background.kind}:amplitude=0.25:sample_rate=48000:seed=617`];
    backgroundNominal=path.join(job,'background-nominal.wav');
    const bg=r.background;
    const bgPan=bg.pan===0?'':`,aformat=channel_layouts=stereo,pan=stereo|c0=${Math.min(1,1-bg.pan)}*c0|c1=${Math.min(1,1+bg.pan)}*c1`;
    const bgFade=[bg.fadeIn>0?`afade=t=in:d=${Math.min(bg.fadeIn,r.duration)}`:'',bg.fadeOut>0?`afade=t=out:st=${Math.max(0,r.duration-bg.fadeOut)}:d=${Math.min(bg.fadeOut,r.duration)}`:''].filter(Boolean).join(',');
    await exec([...input,'-t',String(r.duration),'-af',`highpass=f=${bg.highpassHz},lowpass=f=${bg.lowpassHz},volume=-18dB${bgPan}${bgFade?','+bgFade:''}`,...pcm,backgroundNominal]);
    await exec(['-i',backgroundNominal,'-af',`volume=${r.background.gainDb+18}dB${r.pulse.enabled&&r.variant!=='CONTROL'?`,tremolo=f=${r.pulse.hz}:d=${r.pulse.depth}`:''}`,...pcm,backgroundFile]);
   }
   emit('Miksowanie głosów',0.35);
   let voices,voicesNominal;
   if(prepared.length){
    voices=path.join(job,'voices.wav');
    voicesNominal=path.join(job,'voices-nominal.wav');
    const args=prepared.flatMap(p=>['-stream_loop','-1','-i',p.file]);
    const graph=prepared.map((p,i)=>`[${i}:a]atrim=duration=${r.duration-p.offset},adelay=${Math.round(p.offset*1000)}:all=1,asplit=2[n${i}][g${i}];[g${i}]volume=${p.gainDb}dB[v${i}]`).join(';')+`;${prepared.map((_,i)=>`[v${i}]`).join('')}amix=inputs=${prepared.length}:normalize=0:duration=longest,apad,atrim=duration=${r.duration}[voices];${prepared.map((_,i)=>`[n${i}]`).join('')}amix=inputs=${prepared.length}:normalize=0:duration=longest,apad,atrim=duration=${r.duration}[nominal]`;
    await exec([...args,'-filter_complex',graph,'-map','[voices]','-t',String(r.duration),...pcm,voices,'-map','[nominal]','-t',String(r.duration),...pcm,voicesNominal]);
   }
   const voiceBand=voices?await measure(voices,true):null;
   const backgroundBand=backgroundFile?await measure(backgroundFile,true):null;
   const nominalVoiceBand=voicesNominal?await measure(voicesNominal,true):null;
   const nominalBackgroundBand=backgroundNominal?await measure(backgroundNominal,true):null;
   // volumedetect rounds digital silence to -91 dB. Reject it explicitly.
   const voiceAudible=voiceBand!==null&&voiceBand>-90;
   const backgroundAudible=backgroundBand!==null&&backgroundBand>-90;
   if(r.variant==='DEEP'&&!backgroundAudible)throw new Error('Deep Mask wymaga mierzalnego tła w paśmie mowy.');
   if(!voiceAudible&&!backgroundAudible)throw new Error('Miks jest pusty lub zawiera wyłącznie ciszę.');
   const relative={CLEAR:-6,LOW:-15,MASKED:-25,DEEP:-32,CONTROL:0}[r.variant];
   // Reference uses unity layer gains and nominal -18 dB background. User gains remain independent.
   const gain=nominalVoiceBand!==null&&nominalVoiceBand>-90?(nominalBackgroundBand!==null&&nominalBackgroundBand>-90?nominalBackgroundBand:-24)+relative-nominalVoiceBand:0;
   let voiceBackgroundDb=null,deepMask=null;
   if(voiceAudible){
    const calibrated=path.join(job,'voices-calibrated.wav');
    await exec(['-i',voices,'-af',`volume=${gain}dB`,...pcm,calibrated]);voices=calibrated;
    if(r.variant==='DEEP'){
     emit('Deep Mask · analiza pasm i obwiedni',0.43);
     const deep=await applyDeepMask({voices,background:backgroundFile,duration:r.duration,job,exec,signal});voices=deep.file;deepMask=deep.metrics;
    }
    const actualVoiceBand=await measure(voices,true);
    if(backgroundAudible&&actualVoiceBand!==null&&actualVoiceBand>-90)voiceBackgroundDb=actualVoiceBand-backgroundBand;
   }
   const mix=path.join(job,'mix.wav');
   const fade=Math.min(2,r.duration/8);
   const masterFade=`afade=t=in:d=${fade},afade=t=out:st=${r.duration-fade}:d=${fade}`;
   const inputFiles=[...(voices?[voices]:[]),...(backgroundFile?[backgroundFile]:[])];
   let filters=inputFiles.map((_,i)=>`[${i}:a]anull[m${i}]`).join(';');
   filters+=`;${inputFiles.map((_,i)=>`[m${i}]`).join('')}amix=inputs=${inputFiles.length}:normalize=0:duration=longest,${masterFade}[mix]`;
   await exec([...inputFiles.flatMap(file=>['-i',file]),'-filter_complex',filters,'-map','[mix]','-t',String(r.duration),...pcm,mix]);
   emit('Pomiar głośności · przebieg 1/2',0.55);
   const peakTarget=r.format==='mp3'?-2:-1;
   const normalizer=`loudnorm=I=${r.targetLufs}:TP=${peakTarget}:LRA=11`;
   const first=loudness(await exec(['-i',mix,'-af',`${normalizer}:print_format=json`,'-f','null','-']));
   if(number(first.input_i)===null)throw new Error('Nie można znormalizować ciszy.');
   emit('Eksport · przebieg 2/2',0.72);
   await mkdir(path.dirname(path.resolve(r.outputPath)),{recursive:true});
   temporary=path.join(path.dirname(path.resolve(r.outputPath)),`.auralith-${path.basename(job)}.${r.format}`);
   const codec=r.format==='wav'?['-c:a','pcm_s24le']:r.format==='flac'?['-c:a','flac','-sample_fmt','s32','-bits_per_raw_sample','24']:['-c:a','libmp3lame','-b:a','320k'];
   await exec(['-i',mix,'-af',`${normalizer}:measured_I=${first.input_i}:measured_TP=${first.input_tp}:measured_LRA=${first.input_lra}:measured_thresh=${first.input_thresh}:offset=${first.target_offset}:linear=true:print_format=json`,'-ar','48000','-ac','2','-t',String(r.duration),...codec,'-f',r.format,temporary]);
   emit('Kontrola wyeksportowanego pliku',0.9);
   const metadata=await probeInternal(temporary,signal);
   const qc=loudness(await exec(['-i',temporary,'-af',`${normalizer}:print_format=json`,'-f','null','-']));
   const integratedLufs=number(qc.input_i),truePeakDbtp=number(qc.input_tp);
   const stereo=await stereoQc(temporary,signal);
   if(integratedLufs===null||truePeakDbtp===null)throw new Error('Eksport nie zawiera mierzalnego sygnału.');
   const checks=[
    ...(deepMask?[{label:'Deep Mask · obwiednia',status:'pass',detail:`Analiza co ${deepMask.windowMs} ms w 3 pasmach, osobno L/R; pułap -32 dB RMS względem rzeczywistego tła przed masteringiem. ${deepMask.silentWindows} okien wyciszonych. Pomiar techniczny, bez gwarancji niesłyszalności lub skuteczności.`}]:[]),
    {label:'Głośność z pliku',status:Math.abs(integratedLufs-r.targetLufs)<=1?'pass':'warn',detail:`${integratedLufs.toFixed(1)} LUFS-I; cel ${r.targetLufs}.`},
    {label:'Szczyt rzeczywisty',status:truePeakDbtp<=peakTarget+0.2?'pass':'warn',detail:`${truePeakDbtp.toFixed(2)} dBTP; pomiar nadpróbkowany FFmpeg.`},
    {label:'Format pliku',status:metadata.sampleRate===48000&&metadata.channels===2&&(r.format==='mp3'||metadata.bits===24)?'pass':'fail',detail:`${metadata.sampleRate} Hz · ${metadata.channels} kanały · ${metadata.bits?metadata.bits+' bit':'stratny kodek'}.`},
    {label:'Długość',status:Math.abs(metadata.duration-r.duration)<0.1?'pass':'fail',detail:`${metadata.duration.toFixed(3)} s.`},
    {label:'Poziom głosu',status:voiceBackgroundDb!==null||!voices||r.variant==='CONTROL'?'pass':'warn',detail:voiceBackgroundDb!==null?`Zmierzono ${voiceBackgroundDb.toFixed(1)} dB głos/tło w 300–4000 Hz po suwakach i modulacji tła, przed masteringiem. Profil bazowy ${relative} dB; końcowy limiter może zmienić relację.`:r.variant==='CONTROL'?'Wyłącznie tło; głosy i modulacja wyłączone.':!voices?'Brak aktywnych głosów; wyłącznie tło.':'Brak mierzalnego odniesienia głos/tło; zastosowano poziom odniesienia głosu.'},
    {label:'Zgodność mono',status:stereo.monoLossDb!==null&&stereo.monoLossDb<=3.1?'pass':'warn',detail:`Pomiar eksportu, próbkowanie 12 kHz (pasmo do 6 kHz): korelacja ${stereo.correlation===null?'nieokreślona (cichy kanał)':stereo.correlation.toFixed(3)}; ${stereo.monoCancelled?'całkowite wygaszenie po zsumowaniu':stereo.monoLossDb===null?'strata mono nieokreślona':`strata mono ${stereo.monoLossDb.toFixed(2)} dB`}. Mono=(L+R)/2, odniesienie: średnia energia kanałów.`},
    {label:'Łączenia pętli',status:'pass',detail:'Importowane źródła: 20 ms crossfade między kopiami oraz krótkie obwiednie na granicach cyklu. Ciche dołki na granicach pozostają możliwe.'}
   ];
   if(checks.some(c=>c.status==='fail'))throw new Error('Eksport nie spełnia wymagań formatu lub długości.');
   if(signal?.aborted)throw abortError();
   await rename(temporary,path.resolve(r.outputPath));temporary=undefined;
   // Commit already completed: callback failures must not turn a successful rename into an error.
   try{onProgress?.({stage:'Gotowe',progress:1});}catch{}
   return {path:path.resolve(r.outputPath),duration:metadata.duration,variant:r.variant,format:r.format,metrics:{integratedLufs,truePeakDbtp,sampleRate:metadata.sampleRate,channels:metadata.channels,bits:metadata.bits,clipping:truePeakDbtp>=0,correlation:stereo.correlation,monoLossDb:stereo.monoLossDb,voiceBackgroundDb,...(deepMask?{deepMask}:{})},checks,createdAt:new Date().toISOString()};
  } finally {
   if(temporary)await rm(temporary,{force:true}).catch(()=>{});
   await rm(job,{recursive:true,force:true}).catch(()=>{});
  }
 }
 return {probe:file=>probeInternal(file),waveform,render};
}
