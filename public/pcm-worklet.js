/* Sends continuous mono samples, including the partial last block before the stop acknowledgment. */
class PcmRecorder extends AudioWorkletProcessor {
 constructor(options){
  super();this.chunk=new Float32Array(4096);this.used=0;this.frames=0;this.done=false;
  this.maxFrames=Math.min(Math.floor(sampleRate*600),28800000);
  this.port.onmessage=event=>{if(event.data==='stop')this.finish(false);};
 }
 flush(){if(!this.used)return;const data=this.chunk.slice(0,this.used);this.port.postMessage({type:'chunk',data},[data.buffer]);this.used=0;}
 finish(limited){if(this.done)return;this.done=true;this.flush();this.port.postMessage({type:'stopped',limited});}
 process(inputs){
  if(this.done)return false;
  const channels=inputs[0];if(!channels?.length)return true;
  const count=Math.min(channels[0].length,this.maxFrames-this.frames);
  for(let i=0;i<count;i++){
   let sample=0;for(const channel of channels)sample+=channel[i]||0;
   this.chunk[this.used++]=sample/channels.length;
   if(this.used===this.chunk.length)this.flush();
  }
  this.frames+=count;if(this.frames>=this.maxFrames)this.finish(true);
  return !this.done;
 }
}
registerProcessor('pcm-recorder',PcmRecorder);
