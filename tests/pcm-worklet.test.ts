import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
function processor(){
 const messages:any[]=[];let Processor:any;
 class Base {port={postMessage:(value:any)=>messages.push(value),onmessage:null as any};}
 runInNewContext(readFileSync(new URL('../public/pcm-worklet.js',import.meta.url),'utf8'),{AudioWorkletProcessor:Base,Float32Array,sampleRate:48000,registerProcessor:(_name:string,value:any)=>{Processor=value;}});
 return {instance:new Processor({}),messages};
}
test('worklet flushes every sample before acknowledging stop including partial last block',()=>{
 const {instance,messages}=processor();const source=new Float32Array(4213);for(let i=0;i<source.length;i++)source[i]=i/source.length;
 instance.process([[source]]);instance.port.onmessage({data:'stop'});
 assert.deepEqual(messages.map(m=>m.type),['chunk','chunk','stopped']);
 assert.deepEqual([...messages[0].data,...messages[1].data],[...source]);
 instance.port.onmessage({data:'stop'});assert.equal(messages.length,3);
});
test('worklet caps sample count to 600 seconds and reports the limit after its tail',()=>{
 const {instance,messages}=processor();instance.frames=28800000-19;
 assert.equal(instance.process([[new Float32Array(128).fill(.5)]]),false);
 assert.equal(messages[0].data.length,19);assert.equal(messages[1].type,'stopped');assert.equal(messages[1].limited,true);
});
test('worklet produces mono arithmetic mean from actual supplied channels',()=>{
 const {instance,messages}=processor();instance.process([[new Float32Array([1,-1]),new Float32Array([-1,.5])]]);instance.port.onmessage({data:'stop'});
 assert.deepEqual([...messages[0].data],[0,-.25]);
});
