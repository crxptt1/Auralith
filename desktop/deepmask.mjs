import {createReadStream} from 'node:fs';
import {open} from 'node:fs/promises';
import path from 'node:path';

const rate=12000,framesPerWindow=240,windowMs=20;
const aborted=signal=>{if(signal?.aborted)throw Object.assign(new Error('Renderowanie anulowane.'),{name:'AbortError'});};
// Only window energies are retained: 3 bands × 2 channels × 180000 windows
// for the maximum one-hour job. Decoded audio stays on disk.
async function energies(file,count,signal){
 const result=new Float64Array(count*2);let frame=0,carry=Buffer.alloc(0);
 for await(const chunk of createReadStream(file)){
  aborted(signal);const data=Buffer.concat([carry,chunk]),end=data.length-data.length%8;
  for(let i=0;i<end;i+=8,frame++){const w=Math.floor(frame/framesPerWindow);if(w>=count)break;for(let c=0;c<2;c++)result[w*2+c]+=data.readFloatLE(i+c*4)**2/framesPerWindow;}
  carry=data.subarray(end);
 }
 return result;
}

export async function applyDeepMask({voices,background,duration,job,exec,signal}){
 const count=Math.ceil(duration*1000/windowMs),gains=new Float64Array(count).fill(1);
 const bands=[[300,1000],[1000,2500],[2500,4000]];
 const ratio=10**(-32/20),silencePower=1e-14;
 for(let b=0;b<bands.length;b++){
  const files=[];
  for(const [name,input] of [['voice',voices],['bed',background]]){
   const file=path.join(job,`deep-${name}-${b}.raw`);files.push(file);
   await exec(['-i',input,'-af',`highpass=f=${bands[b][0]}:p=2,lowpass=f=${bands[b][1]}:p=2`,'-ar',String(rate),'-ac','2','-f','f32le',file]);
  }
  const v=await energies(files[0],count,signal),bg=await energies(files[1],count,signal);
  for(let w=0;w<count;w++)for(let c=0;c<2;c++){
   const i=w*2+c;
   if(v[i]>silencePower)gains[w]=Math.min(gains[w],bg[i]<=silencePower?0:ratio*Math.sqrt(bg[i]/v[i]));
  }
 }
 // 60 ms lookahead catches falls before they occur. The minimum of adjacent
 // windows permits interpolation without opening above either window's cap.
 const safe=new Float64Array(count);
 for(let w=0;w<count;w++){let cap=1;for(let k=Math.max(0,w-1);k<=Math.min(count-1,w+3);k++)cap=Math.min(cap,gains[k]);safe[w]=cap;}
 let previous=0,min=1,max=0,silentWindows=0;
 const release=1-Math.exp(-windowMs/250);
 for(let w=0;w<count;w++){previous=Math.min(safe[w],previous+(safe[w]-previous)*release);gains[w]=previous;min=Math.min(min,previous);max=Math.max(max,previous);if(previous===0)silentWindows++;}
 const raw=path.join(job,'deep-input.raw'),output=path.join(job,'deep-output.raw'),result=path.join(job,'voices-deep.wav');
 await exec(['-i',voices,'-ar','48000','-ac','2','-f','f32le',raw]);
 const handle=await open(output,'w');let frame=0,carry=Buffer.alloc(0);
 try{for await(const chunk of createReadStream(raw)){
  aborted(signal);const data=Buffer.concat([carry,chunk]),end=data.length-data.length%8;
  for(let i=0;i<end;i+=8,frame++){
   const position=frame/960,w=Math.min(count-1,Math.floor(position)),fraction=position-Math.floor(position);
   const a=Math.min(gains[Math.max(0,w-1)],gains[w]),z=Math.min(gains[w],gains[Math.min(count-1,w+1)]),gain=a+(z-a)*fraction;
   data.writeFloatLE(data.readFloatLE(i)*gain,i);data.writeFloatLE(data.readFloatLE(i+4)*gain,i+4);
  }
  await handle.write(data.subarray(0,end));carry=Buffer.from(data.subarray(end));
 }}finally{await handle.close();}
 await exec(['-f','f32le','-ar','48000','-ac','2','-i',output,'-c:a','pcm_f32le',result]);
 return {file:result,metrics:{windowMs,bandsHz:bands,ceilingDb:-32,minGainDb:min>0?20*Math.log10(min):null,maxGainDb:max>0?20*Math.log10(max):null,silentWindows}};
}
