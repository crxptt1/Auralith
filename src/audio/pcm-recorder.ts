import {encodePcm24,buildWav24} from './pcm-encoder';
export type PcmCapture={sampleRate:number;stop:()=>Promise<{bytes:ArrayBuffer;limited:boolean}>};
/** The abort signal cancels acquisition; stop drains the worklet before closing the audio graph. */
export async function startPcmCapture(signal:AbortSignal,onLevel:(level:number,seconds:number)=>void,onLimit:()=>void,onError:(error:Error)=>void,deviceId?:string):Promise<PcmCapture>{
 let stream:MediaStream|undefined;let context:AudioContext|undefined;let node:AudioWorkletNode|undefined;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const close=()=>{if(timer)clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());node?.disconnect();if(context&&context.state!=='closed')void context.close().catch(()=>{});};
 const check=()=>{if(signal.aborted)throw new DOMException('Recording cancelled','AbortError');};
 const abort=()=>close();signal.addEventListener('abort',abort,{once:true});
 try{
  check();stream=await navigator.mediaDevices.getUserMedia({audio:{...(deviceId&&deviceId!=='default'?{deviceId:{exact:deviceId}}:{}),channelCount:1,sampleRate:48000,echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});check();
  context=new AudioContext({sampleRate:48000});
  await context.audioWorklet.addModule(new URL('./pcm-worklet.js',document.baseURI).href);check();
  node=new AudioWorkletNode(context,'pcm-recorder',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:1,channelCountMode:'explicit'});
  const rate=context.sampleRate;const chunks:Uint8Array[]=[];let samples=0;let settled=false;let stopping=false;
  let resolve!:(value:{bytes:ArrayBuffer;limited:boolean})=>void;let reject!:(reason:Error)=>void;
  const result=new Promise<{bytes:ArrayBuffer;limited:boolean}>((yes,no)=>{resolve=yes;reject=no;});
  // A hardware error may occur before the UI calls stop; keep rejection handled until it does.
  void result.catch(()=>{});
  const fail=(error:Error)=>{if(settled)return;settled=true;close();reject(error);onError(error);};
  const stop=()=>{if(!settled&&!stopping){stopping=true;node!.port.postMessage('stop');timer=setTimeout(()=>fail(new Error('Nie udało się zakończyć zapisu mikrofonu.')),5000);}return result;};
  node.port.onmessage=event=>{
   if(settled)return;
   if(event.data.type==='chunk'){
    const data=event.data.data as Float32Array;chunks.push(encodePcm24(data));samples+=data.length;
    let sum=0;for(const value of data)sum+=value*value;
    onLevel(Math.min(1,Math.sqrt(sum/data.length)*5),samples/rate);
   }else if(event.data.type==='stopped'){
    settled=true;close();const bytes=buildWav24(chunks,rate);chunks.length=0;resolve({bytes,limited:!!event.data.limited});
    if(event.data.limited)onLimit();
   }
  };
  node.onprocessorerror=()=>fail(new Error('Przerwano przetwarzanie dźwięku mikrofonu.'));
  for(const track of stream.getAudioTracks())track.addEventListener('ended',()=>{void stop();onLimit();},{once:true});
  const source=context.createMediaStreamSource(stream);source.connect(node);node.connect(context.destination);
  await context.resume();check();signal.removeEventListener('abort',abort);
  return {sampleRate:rate,stop};
 }catch(error){signal.removeEventListener('abort',abort);close();throw error;}
}

