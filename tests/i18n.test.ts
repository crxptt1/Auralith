import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getLocale,setLocale,subscribeLocale,t,tMessage,normalizeLocale,localeStorageKey} from '../src/i18n.ts';
import {createProject,duplicateProject,roleLabels,validateProject} from '../src/model.ts';

test('English is the default and unknown locale values fall back to English',()=>{
 assert.equal(getLocale(),'en');assert.equal(normalizeLocale(null),'en');assert.equal(normalizeLocale('de'),'en');assert.equal(t('Ustawienia'),'Settings');assert.equal(t('unmapped technical diagnostic'),'unmapped technical diagnostic');
});
test('interpolation retains parameter order and safely preserves missing parameters',()=>{
 assert.equal(t('Dodaj {0} do warstwy {1}',['Voice','C']),'Add Voice to layer C');
 assert.equal(t('Zdanie {0}',[]),'Sentence {0}');
});
test('language switch persists and notifies without changing existing project content',()=>{
 const storage=new Map<string,string>();const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}});
 try {const p=createProject();const before=structuredClone(p);let events=0;const off=subscribeLocale(()=>events++);
 setLocale('pl');assert.equal(storage.get(localeStorageKey),'pl');assert.equal(events,1);assert.equal(t('Ustawienia'),'Ustawienia');assert.equal(roleLabels.A,'Tożsamość');assert.deepEqual(p,before);
 const polish=createProject();assert.equal(polish.name,'Nowa sesja');assert.match(polish.script[0].text,/Jestem/);assert.match(duplicateProject(polish).name,/kopia/);
 setLocale('en');assert.equal(events,2);assert.equal(roleLabels.A,'Identity');assert.equal(createProject().name,'New session');assert.match(createProject().script[0].text,/I am/);assert.deepEqual(validateProject(p),before);off();
 }finally {setLocale('en');if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');}
});
test('all four presets create English script and selected Polish script',()=>{
 for(const mode of ['classic','forced','spell','forced-spell'] as const){setLocale('en');const en=createProject('Custom',mode);assert.ok(en.script.every(l=>!/[ąćęłńóśźż]/i.test(l.text)));setLocale('pl');const pl=createProject('Custom',mode);assert.notDeepEqual(pl.script.map(l=>l.text),en.script.map(l=>l.text));assert.equal(pl.name,'Custom');}setLocale('en');
});
test('native progress, dynamic quality reports and wrapped failures translate at display time',()=>{
 const detail='Zmierzono -21.0 dB głos/tło w 300–4000 Hz po suwakach i modulacji tła, przed masteringiem. Profil bazowy -24 dB; końcowy limiter może zmienić relację.';
 assert.equal(tMessage('Przygotowanie warstw'),'Preparing layers');assert.equal(tMessage('48000 Hz · 2 kanały · 24 bit.'),'48000 Hz · 2 channels · 24 bit.');assert.match(tMessage(detail),/^Measured -21.0 dB voice\/background/);assert.ok(!/[ąćęłńóśźż]/i.test(tMessage(detail)));
 assert.match(tMessage("Error invoking remote method: Nieprawidłowa biblioteka projektu."),/Invalid project library/);
 setLocale('pl');assert.equal(tMessage('Session playback'),'Odsłuch sesji');assert.equal(tMessage('Preview · 00:15'),'Podgląd · 00:15');setLocale('en');
});
