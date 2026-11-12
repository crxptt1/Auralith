import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,validateProject,migrateProject,highFrequencyProfile,type Variant} from '../src/model';
test('both high-frequency variants survive save and migration',()=>{
 for(const variant of ['ULTRASONIC','NEAR']){
  const p={...createProject(),variant};
  assert.equal(validateProject(p).variant,variant);
  assert.equal(migrateProject(JSON.parse(JSON.stringify(p))).variant,variant);
  const history={...p,exports:[{id:'render',path:'test.wav',url:'auralith://audio/test',duration:5,variant,format:'wav',createdAt:p.createdAt,metrics:{integratedLufs:null,truePeakDbtp:-24,correlation:1,sampleRate:variant==='ULTRASONIC'?96000:48000,channels:2,bits:24,clipping:false},checks:[]}]};
  assert.equal(validateProject(history).exports[0].variant,variant);
 }
});
test('profile bandwidth fits output Nyquist; old variants remain ordinary',()=>{
 for(const variant of ['ULTRASONIC','NEAR'] as Variant[]){const p=highFrequencyProfile(variant)!;assert.ok(p.highHz<p.sampleRate/2);assert.equal(p.carrierHz-p.lowHz,3000);assert.equal(p.highHz-p.carrierHz,3000);}
 for(const variant of ['CLEAR','LOW','MASKED','DEEP','CONTROL'] as Variant[])assert.equal(highFrequencyProfile(variant),null);
 assert.equal(migrateProject(createProject()).variant,'LOW');
});
