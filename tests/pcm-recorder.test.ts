import test from 'node:test';
import assert from 'node:assert/strict';
import {startPcmCapture} from '../src/audio/pcm-recorder';
const noop=()=>{};
test('cancelling while permission is pending stops the eventual granted stream',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');let grant!:(value:MediaStream)=>void;let stops=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>{grant=resolve;})}}});
 try{
  const abort=new AbortController();const pending=startPcmCapture(abort.signal,noop,noop,noop);abort.abort();
  grant({getTracks:()=>[{stop:()=>{stops++;}}]} as unknown as MediaStream);
  await assert.rejects(pending,{name:'AbortError'});assert.equal(stops,1);
 }finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else Reflect.deleteProperty(globalThis,'navigator');}
});
test('worklet startup failure stops tracks and closes the context',async()=>{
 const keys=['navigator','AudioContext','document'] as const;const previous=keys.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));let stops=0;let closes=0;
 const values={navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>{stops++;}}]})}},document:{baseURI:'file:///app/dist/index.html'},AudioContext:class {state='running';audioWorklet={addModule:async(url:string)=>{assert.equal(url,'file:///app/dist/pcm-worklet.js');throw new Error('worklet unavailable');}};async close(){closes++;this.state='closed';}}};
 keys.forEach(key=>Object.defineProperty(globalThis,key,{configurable:true,value:values[key]}));
 try{await assert.rejects(startPcmCapture(new AbortController().signal,noop,noop,noop),/worklet unavailable/);assert.equal(stops,1);assert.equal(closes,1);}
 finally{keys.forEach((key,i)=>{if(previous[i])Object.defineProperty(globalThis,key,previous[i]!);else Reflect.deleteProperty(globalThis,key);});}
});

test('selected microphone uses an exact device constraint and never falls back',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');let calls=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async(constraints:MediaStreamConstraints)=>{calls++;assert.deepEqual((constraints.audio as MediaTrackConstraints).deviceId,{exact:'usb-microphone'});throw new DOMException('Missing microphone','OverconstrainedError');}}}});
 try{await assert.rejects(startPcmCapture(new AbortController().signal,noop,noop,noop,'usb-microphone'),{name:'OverconstrainedError'});assert.equal(calls,1);}
 finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else Reflect.deleteProperty(globalThis,'navigator');}
});

test('system default adds no exact device restriction',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async(constraints:MediaStreamConstraints)=>{assert.equal((constraints.audio as MediaTrackConstraints).deviceId,undefined);throw new DOMException('No access','NotAllowedError');}}}});
 try{await assert.rejects(startPcmCapture(new AbortController().signal,noop,noop,noop,''),{name:'NotAllowedError'});}
 finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else Reflect.deleteProperty(globalThis,'navigator');}
});
