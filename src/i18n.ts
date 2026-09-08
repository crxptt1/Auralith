import {english} from './translations.js';
export type Locale='en'|'pl';
export const localeStorageKey='auralith-locale';
export const normalizeLocale=(value:unknown):Locale=>value==='pl'?'pl':'en';
let locale:Locale='en';
try {locale=normalizeLocale(globalThis.localStorage?.getItem(localeStorageKey));} catch {/* Storage may be unavailable in a sandbox. */}
const listeners=new Set<()=>void>();
export const getLocale=()=>locale;
export const subscribeLocale=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export function setLocale(value:Locale){const next=normalizeLocale(value);try{globalThis.localStorage?.setItem(localeStorageKey,next);}catch{}if(locale===next)return;locale=next;for(const listener of listeners)listener();}
export function t(key:string,values:readonly unknown[]=[],language:Locale=locale):string {const template=language==='en'?(english[key]??key):key;return template.replace(/\{(\d+)\}/g,(token,index)=>index in values?String(values[Number(index)]):token);}
const entries=Object.entries(english);
const reversed=Object.fromEntries(entries.map(([pl,en])=>[en,pl]));
const escapeRegex=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const translations={en:entries,pl:entries.map(([pl,en])=>[en,pl])}.en;
function messageEntries(language:Locale){return language==='en'?translations:entries.map(([pl,en])=>[en,pl]);}
const fragments={en:messageEntries('en').filter(([key])=>key.trim().length>=5&&!key.includes('{')).sort((a,b)=>b[0].length-a[0].length),pl:messageEntries('pl').filter(([key])=>key.trim().length>=5&&!key.includes('{')).sort((a,b)=>b[0].length-a[0].length)};
// Translate persisted/native diagnostic strings only at the display boundary.
// Project names, script text and recording names are never passed through here.
export function tMessage(message:string):string {
 const direct=locale==='en'?english:reversed;
 if(direct[message])return direct[message];
 for(const [source,target] of messageEntries(locale)){
  if(!/\{\d+\}/.test(source))continue;
  const indices=[...source.matchAll(/\{(\d+)\}/g)].map(m=>Number(m[1]));
  const pattern=source.split(/\{\d+\}/).map(escapeRegex).join('(.*?)');
  const match=message.match(new RegExp('^'+pattern+'$'));
  if(match)return target.replace(/\{(\d+)\}/g,(token,i)=>match[indices.indexOf(Number(i))+1]??token);
 }
 let result=message;
 for(const [source,target] of fragments[locale])result=result.split(source).join(target);
 return result;
}
export const setLanguage=setLocale;
