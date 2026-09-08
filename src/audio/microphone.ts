/** Enumerates devices only: never requests permission or opens a microphone. */
export function watchMicrophones(media:MediaDevices,onDevices:(devices:MediaDeviceInfo[])=>void,onError:()=>void){
 let disposed=false;let revision=0;
 const refresh=async()=>{const current=++revision;try{const devices=await media.enumerateDevices();if(!disposed&&current===revision)onDevices(devices.filter(device=>device.kind==='audioinput'&&!!device.deviceId&&device.deviceId!=='default'));}catch{if(!disposed&&current===revision)onError();}};
 const change=()=>{void refresh();};
 media.addEventListener('devicechange',change);
 return {refresh,dispose:()=>{disposed=true;media.removeEventListener('devicechange',change);}};
}
