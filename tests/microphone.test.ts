import test from 'node:test';
import assert from 'node:assert/strict';
import {watchMicrophones} from '../src/audio/microphone';
test('enumeration filters inputs, refreshes on devicechange and ignores late results after disposal',async()=>{
 const events=new EventTarget();let devices=[{kind:'audioinput',deviceId:'usb',label:'USB'},{kind:'audiooutput',deviceId:'speaker',label:'Speaker'}];let calls=0;
 const media=Object.assign(events,{enumerateDevices:async()=>{calls++;return devices;}}) as unknown as MediaDevices;
 const updates:MediaDeviceInfo[][]=[];const watcher=watchMicrophones(media,value=>updates.push(value),()=>assert.fail('enumeration failed'));
 await watcher.refresh();assert.deepEqual(updates.at(-1)?.map(d=>d.deviceId),['usb']);
 devices=[];events.dispatchEvent(new Event('devicechange'));await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(updates.at(-1),[]);
 watcher.dispose();const before=calls;events.dispatchEvent(new Event('devicechange'));assert.equal(calls,before);
 await watcher.refresh();assert.equal(updates.length,2);
});

test('late enumeration cannot update an unmounted picker',async()=>{
 const events=new EventTarget();let complete!:(value:MediaDeviceInfo[])=>void;let updates=0;
 const media=Object.assign(events,{enumerateDevices:()=>new Promise<MediaDeviceInfo[]>(resolve=>{complete=resolve;})}) as unknown as MediaDevices;
 const watcher=watchMicrophones(media,()=>updates++,()=>assert.fail('unexpected error'));
 const pending=watcher.refresh();watcher.dispose();complete([]);await pending;assert.equal(updates,0);
});
test('enumeration failures are reported without opening a microphone',async()=>{
 const media=Object.assign(new EventTarget(),{enumerateDevices:async()=>{throw new Error('unavailable');}}) as unknown as MediaDevices;let failures=0;
 const watcher=watchMicrophones(media,()=>assert.fail('unexpected devices'),()=>failures++);
 await watcher.refresh();assert.equal(failures,1);watcher.dispose();
});
