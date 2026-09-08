import test from 'node:test';
import assert from 'node:assert/strict';
import {encodePcm24, buildWav24} from '../src/audio/pcm-encoder';

test('encodes signed 24-bit boundaries, silence, finite clipping and non-finite silence',()=>{
 const pcm=encodePcm24(new Float32Array([-2,-1,-.5,0,.5,1,2,NaN,Infinity,-Infinity]));
 assert.deepEqual([...pcm],[0,0,128,0,0,128,0,0,192,0,0,0,0,0,64,255,255,127,255,255,127,0,0,0,0,0,0,0,0,0]);
});
test('writes mono PCM RIFF metadata using actual capture sample rate and pads odd data',()=>{
 const pcm=encodePcm24(new Float32Array([1]));const wav=buildWav24([pcm],44100);const v=new DataView(wav);
 const s=(offset:number,n:number)=>String.fromCharCode(...new Uint8Array(wav,offset,n));
 assert.equal(s(0,4),'RIFF');assert.equal(s(8,4),'WAVE');assert.equal(s(12,4),'fmt ');
 assert.equal(v.getUint32(4,true),40);assert.equal(v.getUint16(20,true),1);assert.equal(v.getUint16(22,true),1);
 assert.equal(v.getUint32(24,true),44100);assert.equal(v.getUint32(28,true),132300);
 assert.equal(v.getUint16(32,true),3);assert.equal(v.getUint16(34,true),24);assert.equal(s(36,4),'data');assert.equal(v.getUint32(40,true),3);
 assert.deepEqual([...new Uint8Array(wav,44)],[255,255,127,0]);
});
test('concatenates PCM chunks without gaps',()=>{
 const wav=buildWav24([encodePcm24(new Float32Array([-1])),encodePcm24(new Float32Array([1,0]))],48000);
 assert.deepEqual([...new Uint8Array(wav,44,9)],[0,0,128,255,255,127,0,0,0]);
});
