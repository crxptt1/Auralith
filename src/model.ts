import {t, tMessage, getLocale} from './i18n.js';
export type Mode = 'classic' | 'forced' | 'spell' | 'forced-spell';
export type Role = 'A' | 'B' | 'C';
export type Variant = 'CLEAR' | 'LOW' | 'MASKED' | 'CONTROL';
export type Format = 'wav' | 'flac' | 'mp3';
export type Screen = 'projects' | 'script' | 'voices' | 'studio' | 'exports';
export interface Line {id:string; text:string; role:Role}
export interface Asset {id:string;name:string;path:string;url:string;duration:number;peaks:number[];sampleRate?:number;channels?:number}
export interface Layer {id:string;assetId:string;name:string;path:string;url:string;peaks:number[];duration:number;role:Role;gainDb:number;pan:number;speed:number;reverse:boolean;offset:number;muted:boolean;solo:boolean}
export interface Check {label:string;status:'pass'|'warn'|'fail';detail:string}
export interface RenderResult {id:string;path:string;url:string;duration:number;variant:Variant;format:Format;createdAt:string;metrics:{integratedLufs:number|null;truePeakDbtp:number|null;sampleRate:number;channels:number;bits:number;clipping:boolean|null;correlation:number|null;monoLossDb?:number|null;voiceBackgroundDb?:number|null};checks:Check[]}
export interface ComparisonResult {id:string;createdAt:string;firstId:string;secondId:string;firstVotes:number;secondVotes:number;ties:number}
export interface Project {notes?:string;musicCredit?:string;comparisons?:ComparisonResult[];schemaVersion:2;id:string;name:string;mode:Mode;createdAt:string;updatedAt:string;script:Line[];layers:Layer[];duration:number;variant:Variant;targetLufs:number;background:{kind:'brown'|'pink'|'none'|'file';path?:string;name?:string;gainDb:number};pulse:{enabled:boolean;hz:number;depth:number};exports:RenderResult[]}
export interface Progress {stage:string;progress:number}
export interface UpdateStatus {phase:string;enabled:boolean;version:string;progress:number}
export interface Bridge {
  updateStatus?():Promise<UpdateStatus>;
  setUpdateChecks?(enabled:boolean):Promise<void>;
  checkUpdates?():Promise<void>;
  downloadUpdate?():Promise<void>;
  installUpdate?():Promise<void>;
  onUpdateStatus?(fn:(status:UpdateStatus)=>void):()=>void;
  openSupport?(url:string):Promise<void>;
  setLanguage?(language:'en'|'pl'):Promise<void>;
  bootstrap():Promise<{projects:Project[];assets:Asset[];version:string;dataPath:string}>;
  saveProject(project:Project):Promise<Project>;
  removeAsset(id:string):Promise<void>;
  importAudio():Promise<Asset[]>;
  importText():Promise<string|null>;
  importProject():Promise<unknown|null>;
  exportProject(project:Project):Promise<boolean>;
  synthesize(request:{text:string;voice:string;rate:number;name:string}):Promise<Asset>;
  saveRecording(request:{bytes:ArrayBuffer;name:string;format?:'wav'|'webm'}):Promise<Asset>;
  render(request:{project:Project;format:Format;preview:boolean}):Promise<RenderResult>;
  cancelRender():Promise<void>;
  onProgress(fn:(progress:Progress)=>void):()=>void;
  reveal(path:string):Promise<void>;
  exportFile(path:string):Promise<boolean>;
  windowControl(action:'minimize'|'maximize'|'close'|'close-saved'):void;
  onCloseRequested?:(fn:()=>void)=>()=>void;
}
declare global {interface Window {auralith?:Bridge}}

export const uid=()=>crypto.randomUUID();
export const modeLabels:Record<Mode,string>={classic:'Classic',forced:'Forced',spell:'Spell','forced-spell':'Forced + Spell'};
export const roleLabels:Record<Role,string>={get A(){return t('Tożsamość');},get B(){return t('Intencja');},get C(){return t('Wyobrażenie');}};
export const templateLines:Record<Mode,Array<[Role,string]>>={
  classic:[['A','Jestem spokojny i obecny w tej chwili.'],['B','Oddycham swobodnie i rozluźniam napięcie.'],['C','Wyobrażam sobie, jak z łatwością wracam do skupienia.']],
  forced:[['A','Wybieram pewność siebie. To moja decyzja.'],['B','Skup się. Oddychaj. Działaj z przekonaniem.'],['B','Wracaj do celu za każdym razem, gdy uwaga odpływa.'],['C','Widzę siebie działającego spokojnie i zdecydowanie.']],
  'forced-spell':[['A','Moja decyzja jest jasna. Wybieram spokój i pewność.'],['B','Skup się na intencji. Wprowadzaj ją w życie krok po kroku.'],['C','Z każdym oddechem nadaję swojej intencji wyraźny kształt.'],['C','Wyobrażam sobie, jak działam pewnie, w swoim rytmie.']],
  spell:[['A','Z każdym oddechem wracam do swojej przestrzeni.'],['B','Niech ta chwila będzie początkiem mojego skupienia.'],['C','Wyobrażam sobie światło, które łagodnie wypełnia przestrzeń.'],['C','Zamykam tę intencję w spokojnym rytmie oddechu.']]
};
export function createProject(name=t("Nowa sesja"),mode:Mode='classic'):Project {
  const now=new Date().toISOString();
  return {schemaVersion:2,id:uid(),name,mode,createdAt:now,updatedAt:now,script:templateLines[mode].map(([role,text])=>({id:uid(),role,text:t(text)})),layers:[],duration:180,variant:'LOW',targetLufs:-18,background:{kind:(mode==='spell'||mode==='forced-spell')?'pink':'brown',gainDb:-18},pulse:{enabled:false,hz:6,depth:0.2},exports:[]};
}
export function applyMode(p:Project,mode:Mode):Project{return {...p,mode};}
export function duplicateProject(p:Project):Project{const now=new Date().toISOString();return {...structuredClone(p),id:uid(),name:t("{0} · kopia", [p.name.slice(0,185)]),createdAt:now,updatedAt:now,exports:[],comparisons:[],script:p.script.map(l=>({...l,id:uid()})),layers:p.layers.map(l=>({...l,id:uid()}))};}
export function findRepeatedLines(lines:Line[]):string[]{const seen=new Set<string>();const repeated:string[]=[];for(const line of lines){const key=line.text.toLocaleLowerCase('pl').replace(/[^\p{L}\p{N}\s]/gu,'').replace(/\s+/g,' ').trim();if(!key)continue;if(seen.has(key))repeated.push(line.id);seen.add(key);}return repeated;}
export function personalizeScript(lines:Line[],name:string):Line[]{return lines.map(l=>({...l,text:l.text.replace(/\{(?:imię|imie|name)\}/gi,()=>name.trim())}));}
export function parseScript(text:string):Line[]{
  let role:Role='A';
  const roles:Record<string,Role>={a:'A',b:'B',c:'C',identity:'A',intention:'B',imagination:'C','tożsamość':'A',tozsamosc:'A',intencja:'B','wyobrażenie':'C',wyobrazenie:'C','wyobraźnia':'C',wyobraznia:'C'};
  const roleFor=(label:string)=>roles[label.trim().replace(/^(\*\*|__)(.*?)\1$/,'$2').toLowerCase()];
  const result:Line[]=[];
  for(const raw of text.split(/\r\n?|\n/)){
    let line=raw.trim();
    if(!line||/^(?:`{3,}|~{3,})/.test(line)||/^(?:[-*_]\s*){3,}$/.test(line))continue;
    // A table is interpreted only when its first cell is an explicit role.
    if(line.includes('|')&&!/^(?:\[[ABC]\]|[ABC])\s*\|/i.test(line)){
      const cells=line.replace(/^\|/,'').replace(/(?<!\\)\|$/,'').split(/(?<!\\)\|/).map(cell=>cell.trim().replace(/\\\|/g,'|'));
      if(cells.length>=2){
        if(cells.every(cell=>/^:?-{3,}:?$/.test(cell)))continue;
        if(/^(?:role|rola|layer|warstwa)$/i.test(cells[0])&&/^(?:affirmation|afirmacja|text|tekst)$/i.test(cells[1]))continue;
        const tableRole=roleFor(cells[0].replace(/^\[|\]$/g,''));
        if(tableRole&&cells[1]){result.push({id:uid(),role:tableRole,text:cells.slice(1).join(' | ')});if(result.length===500)break;continue;}
      }
    }
    const heading=/^#{1,6}\s+/.test(line);
    line=line.replace(/^#{1,6}\s+/,'').replace(/\s+#+$/,'').replace(/^(?:[-*+•]\s+|\d+[.)]\s+)/,'');
    const section=line.replace(/^(?:\*\*|__)(.*?)(?:\*\*|__)$/,'$1').replace(/:$/,'').trim();
    const namedRole=roleFor(section);
    const layer=section.match(/^(?:warstwa|layer)\s+([ABC])\b(?:\s.*)?$/i);
    const marked=section.match(/^\[([ABC])\]$/i);
    const titled=heading?section.match(/^([ABC])\s*[-—–:.)]\s*.+$/i):null;
    if(namedRole||layer||marked||titled){role=namedRole||(layer?.[1]||marked?.[1]||titled?.[1])!.toUpperCase() as Role;continue;}
    if(heading)continue;
    const prefix=line.match(/^(?:\[([ABC])\]\s*|([ABC])\s*[:|)]\s*)(.*)$/i);
    if(prefix){
      const inlineRole=(prefix[1]||prefix[2]).toUpperCase() as Role;
      if(!prefix[3].trim()){role=inlineRole;continue;}
      result.push({id:uid(),role:inlineRole,text:prefix[3].trim()});
    }else if(line)result.push({id:uid(),role,text:line});
    if(result.length===500)break;
  }
  return result;
}
function numberIn(value:unknown,min:number,max:number,name:string):number{
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(t("Nieprawidłowa wartość: {0}.", [name]));return value;
}
function textIn(value:unknown,max:number,name:string):string{
  if(typeof value!=='string'||value.length>max)throw new Error(t("Nieprawidłowe pole: {0}.", [name]));return value;
}
function dateIn(value:unknown,name:string){textIn(value,80,name);if(!Number.isFinite(Date.parse(value as string)))throw new Error(t("Nieprawidłowa data: {0}.", [name]));}
export function validateProject(input:unknown):Project {
  if(!input||typeof input!=='object')throw new Error(t("To nie jest plik projektu."));
  const p=structuredClone(input) as Project;
  if(p.schemaVersion!==2)throw new Error(t("Nieobsługiwana wersja projektu."));
  textIn(p.id,100,t("identyfikator"));if(!/^[a-zA-Z0-9_-]+$/.test(p.id))throw new Error(t("Nieprawidłowy identyfikator projektu."));
  dateIn(p.createdAt,t("utworzenie"));dateIn(p.updatedAt,t("ostatni zapis"));textIn(p.name,200,t("nazwa"));if(!p.name.trim())throw new Error(t("Nadaj projektowi nazwę."));
  if(!['classic','forced','spell','forced-spell'].includes(p.mode)||!['CLEAR','LOW','MASKED','CONTROL'].includes(p.variant))throw new Error(t("Nieprawidłowy tryb projektu."));
  numberIn(p.duration,5,3600,t("czas"));numberIn(p.targetLufs,-24,-14,t("głośność"));
  if(!p.background||!['brown','pink','none','file'].includes(p.background.kind))throw new Error(t("Nieprawidłowe tło."));
  numberIn(p.background.gainDb,-60,0,t("poziom tła"));
  if(!p.pulse||typeof p.pulse.enabled!=='boolean')throw new Error(t("Nieprawidłowa modulacja."));
  numberIn(p.pulse.hz,1,30,t("puls"));numberIn(p.pulse.depth,0,0.5,t("głębokość"));
  if(!Array.isArray(p.script)||p.script.length>500)throw new Error(t("Projekt może mieć do 500 zdań."));
  for(const line of p.script){textIn(line.id,100,t("identyfikator zdania"));textIn(line.text,3000,t("tekst"));if(!['A','B','C'].includes(line.role))throw new Error(t("Nieprawidłowa rola zdania."));}
  if(!Array.isArray(p.layers)||p.layers.length>32)throw new Error(t("Projekt może mieć do 32 warstw."));
  for(const l of p.layers){
    textIn(l.id,100,t("identyfikator warstwy"));textIn(l.assetId,100,t("identyfikator nagrania"));textIn(l.url,2500,t("adres nagrania"));numberIn(l.duration,0,3600,t("czas nagrania"));if(!Array.isArray(l.peaks)||l.peaks.length>2000||l.peaks.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1))throw new Error(t("Nieprawidłowa obwiednia nagrania."));textIn(l.path,2000,t("plik warstwy"));textIn(l.name,300,t("nazwa warstwy"));
    numberIn(l.gainDb,-60,12,'gain');numberIn(l.pan,-1,1,t("panorama"));numberIn(l.speed,0.5,2,t("tempo"));numberIn(l.offset,0,p.duration,t("przesunięcie"));
    if(!['A','B','C'].includes(l.role)||typeof l.muted!=='boolean'||typeof l.solo!=='boolean'||typeof l.reverse!=='boolean')throw new Error(t("Nieprawidłowa konfiguracja warstwy."));
  }
  if(p.notes!==undefined)textIn(p.notes,12000,t("notatki"));if(p.musicCredit!==undefined)textIn(p.musicCredit,2000,t("źródło muzyki"));
  if(p.comparisons!==undefined){if(!Array.isArray(p.comparisons)||p.comparisons.length>1000)throw new Error(t("Nieprawidłowe porównania."));for(const c of p.comparisons){dateIn(c.createdAt,t("porównanie"));textIn(c.id,100,t("identyfikator porównania"));textIn(c.firstId,100,t("plik A"));textIn(c.secondId,100,t("plik B"));for(const n of [c.firstVotes,c.secondVotes,c.ties]){numberIn(n,0,10,t("głosy"));if(!Number.isInteger(n))throw new Error(t("Nieprawidłowa liczba prób."));}if(c.firstVotes+c.secondVotes+c.ties!==10)throw new Error(t("Porównanie musi mieć 10 prób."));}}
  if(!Array.isArray(p.exports))p.exports=[];
  if(p.exports.length>2000)throw new Error(t("Zbyt wiele eksportów."));
  for(const r of p.exports){dateIn(r.createdAt,t("eksport"));textIn(r.id,100,t("identyfikator eksportu"));textIn(r.path,2000,t("plik eksportu"));textIn(r.url,2500,t("adres eksportu"));numberIn(r.duration,0,3600,t("długość eksportu"));if(!['wav','mp3','flac'].includes(r.format)||!['CLEAR','LOW','MASKED','CONTROL'].includes(r.variant)||!r.metrics)throw new Error(t("Nieprawidłowy eksport."));for(const v of [r.metrics.integratedLufs,r.metrics.truePeakDbtp,r.metrics.correlation])if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)))throw new Error(t("Nieprawidłowy pomiar."));if(!Array.isArray(r.checks)||r.checks.length>40)throw new Error(t("Nieprawidłowy raport."));for(const c of r.checks){textIn(c.label,500,t("kontrola"));textIn(c.detail,5000,t("opis kontroli"));if(!['pass','warn','fail'].includes(c.status))throw new Error(t("Nieprawidłowy wynik kontroli."));}}
  return p;
}
export function migrateProject(input:unknown):Project {
  if(!input||typeof input!=='object')throw new Error(t("Nieprawidłowy projekt."));
  const old=input as Record<string,unknown>;
  if(old.schemaVersion===2)return validateProject(old);
  if(!Array.isArray(old.lines))throw new Error(t("Brak rozpoznanej struktury projektu."));
  const p=createProject(typeof old.id==='string'?old.id:t("Zaimportowany projekt"));
  p.script=old.lines.map((l:Record<string,unknown>)=>({id:uid(),text:String(l.text??''),role:(['A','B','C'].includes(String(l.layer))?l.layer:'A') as Role}));
  const mix=(old.mix??{}) as Record<string,unknown>;
  if(typeof mix.durationS==='number')p.duration=Math.max(5,Math.min(3600,mix.durationS));
  if(typeof mix.targetLufs==='number')p.targetLufs=Math.max(-24,Math.min(-14,mix.targetLufs));
  return validateProject(p);
}
export function layerFromAsset(a:Asset,role:Role='A'):Layer{return {id:uid(),assetId:a.id,name:a.name,path:a.path,url:a.url,peaks:a.peaks,duration:a.duration,role,gainDb:0,pan:role==='A'?0:role==='B'?-0.18:0.18,speed:1,reverse:false,offset:0,muted:false,solo:false};}
export const clock=(seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
export const formatDate=(s:string)=>new Intl.DateTimeFormat(getLocale(),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
export const db=(n:number)=>`${n>0?'+':''}${n.toFixed(0)} dB`;
