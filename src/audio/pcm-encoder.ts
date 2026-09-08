/** Signed little-endian 24-bit PCM; invalid samples become silence. */
export function encodePcm24(samples:Float32Array):Uint8Array {
 const bytes=new Uint8Array(samples.length*3);
 for(let i=0;i<samples.length;i++){
  const value=Number.isFinite(samples[i])?Math.max(-1,Math.min(1,samples[i])):0;
  const sample=Math.round(value*(value<0?8388608:8388607));
  bytes[i*3]=sample;bytes[i*3+1]=sample>>8;bytes[i*3+2]=sample>>16;
 }
 return bytes;
}
export function buildWav24(chunks:Uint8Array[],sampleRate:number):ArrayBuffer {
 const length=chunks.reduce((n,c)=>n+c.byteLength,0);const padded=length+(length%2);
 const buffer=new ArrayBuffer(44+padded);const view=new DataView(buffer);
 const ascii=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
 ascii(0,'RIFF');view.setUint32(4,36+padded,true);ascii(8,'WAVE');ascii(12,'fmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
 view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*3,true);view.setUint16(32,3,true);view.setUint16(34,24,true);
 ascii(36,'data');view.setUint32(40,length,true);const target=new Uint8Array(buffer);let offset=44;
 for(const chunk of chunks){target.set(chunk,offset);offset+=chunk.byteLength;}return buffer;
}
