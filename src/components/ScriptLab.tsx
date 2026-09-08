import {t, tMessage, getLocale} from '../i18n.js';
import {Plus,Upload,Trash2,ArrowRight,AlignLeft,Copy,Check,BookOpen,Info} from 'lucide-react';
import {type Project,type Role,type Mode,roleLabels,templateLines,uid,findRepeatedLines,personalizeScript} from '../model';
import {RoleBadge} from './Primitives';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import '../import-help.css';

function ImportHelp(){
 const [open,setOpen]=useState(false);const [position,setPosition]=useState({top:0,left:0});
 const trigger=useRef<HTMLButtonElement>(null);const panel=useRef<HTMLDivElement>(null);const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);const id=useId();
 const copy=(en:string,pl:string)=>getLocale()==='pl'?pl:en;
 const cancelClose=()=>{if(timer.current)clearTimeout(timer.current);};
 const show=()=>{cancelClose();setOpen(true);};
 const hide=()=>{cancelClose();timer.current=setTimeout(()=>setOpen(false),140);};
 useEffect(()=>()=>cancelClose(),[]);
 useEffect(()=>{
  if(!open)return;
  const place=()=>{const rect=trigger.current?.getBoundingClientRect();if(rect)setPosition({top:Math.min(rect.bottom+10,Math.max(12,window.innerHeight-(panel.current?.offsetHeight||390)-12)),left:Math.max(12,Math.min(rect.right-380,window.innerWidth-392))});};
  const dismiss=(event:PointerEvent)=>{if(!trigger.current?.contains(event.target as Node)&&!panel.current?.contains(event.target as Node))setOpen(false);};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
  place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',key);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',key);};
 },[open]);
 return <><button ref={trigger} className="icon-button import-help-trigger" aria-label={copy('Text import formats','Formaty importu tekstu')} aria-describedby={open?id:undefined} aria-expanded={open} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onClick={show}><Info size={17}/></button>{open&&createPortal(<div ref={panel} id={id} role="tooltip" className="import-help-panel" style={position} onMouseEnter={show} onMouseLeave={hide}>
  <div className="import-help-heading"><span className="import-help-symbol"><Upload size={18}/></span><div><strong>{copy('Bring your own words','Zaimportuj własne słowa')}</strong><span>TXT · Markdown (.md)</span></div></div>
  <p>{copy('One affirmation per line. Mark its role, or group lines under a section heading.','Jedna afirmacja w wierszu. Oznacz rolę lub pogrupuj zdania pod nagłówkiem sekcji.')}</p>
  <div className="import-help-roles">{(['A','B','C'] as Role[]).map(role=><span key={role}><RoleBadge role={role}/>{roleLabels[role]}</span>)}</div>
  <div className="import-help-example"><span>{copy('Inline roles','Role w wierszach')}</span><pre>{copy('a) I am calm.\nb) I choose to focus.\nc) I picture a quiet place.','a) Jestem spokojny.\nb) Wybieram skupienie.\nc) Widzę spokojne miejsce.')}</pre><small>{copy('Also accepted:','Działają również:')} <code>A: …</code> <code>A| …</code> <code>[A] …</code></small></div>
  <div className="import-help-example"><span>{copy('Sections in TXT or Markdown','Sekcje w TXT lub Markdown')}</span><pre>{copy('## Intention\n- I act with care.\n- I return to my goal.','## Intencja\n- Działam uważnie.\n- Wracam do swojego celu.')}</pre></div>
  <p className="import-help-note">{copy('English and Polish role names, [A] / [B] / [C] sections, numbered lists and Role | Affirmation tables work too. Unmarked lines use the current section, or A by default. Up to 500 lines.','Obsługiwane są polskie i angielskie nazwy ról, sekcje [A] / [B] / [C], listy numerowane i tabele Rola | Afirmacja. Nieoznaczone zdania trafiają do bieżącej sekcji, domyślnie A. Do 500 zdań.')}</p>
 </div>,document.body)}</>;
}

export function ScriptLab({project,update,importText,goVoices}:{project:Project;update:(fn:(p:Project)=>Project)=>void;importText:()=>void;goVoices:()=>void}){
 const [filter,setFilter]=useState<Role|'all'>('all');const [copied,setCopied]=useState(false);
 const [personalName,setPersonalName]=useState('');const repeated=findRepeatedLines(project.script);const placeholders=project.script.some(l=>/\{(?:imię|imie|name)\}/i.test(l.text));
 const lines=project.script.filter(l=>filter==='all'||l.role===filter);
 const words=project.script.reduce((n,l)=>n+l.text.trim().split(/\s+/).filter(Boolean).length,0);
 return <div className="content-page"><div className="page-heading"><div><span className="eyebrow">{t("WSZYSTKO ZACZYNA SIĘ OD SŁÓW")}</span><h1>{t("Napisz swoją ")}<em>{t("intencję.")}</em></h1><p>{t("Własne zdania, własne znaczenie. Ułóż tekst w trzy role głosu.")}</p></div><button className="button primary" onClick={goVoices}>{t("Nadaj tekstowi głos ")}<ArrowRight size={16}/></button></div>
 {placeholders&&<div className="script-personalize"><div><strong>{t("Dodaj osobisty akcent")}</strong><p>{t("Podmień oznaczenia ")}{'{imię}'} {t('i')} {'{name}'} {t(" w swoim tekście.")}</p></div><input aria-label={t("Imię do personalizacji")} placeholder={t("Twoje imię")} value={personalName} maxLength={80} onChange={e=>setPersonalName(e.target.value)}/><button className="button small" disabled={!personalName.trim()} onClick={()=>update(p=>({...p,script:personalizeScript(p.script,personalName)}))}>{t("Wstaw imię")}</button></div>}
 {repeated.length>0&&<div className="duplicate-notice"><Copy size={15}/><span>{repeated.length} {t(" powtarzających się zdań. Możesz zachować celowe powtórzenia.")}</span><button className="text-button" onClick={()=>update(p=>({...p,script:p.script.filter(l=>!repeated.includes(l.id))}))}>{t("Usuń duplikaty")}</button></div>}
 <div className="script-layout"><section className="script-paper"><div className="script-toolbar"><div className="segmented">{(['all','A','B','C'] as const).map(r=><button key={r} className={filter===r?'active':''} onClick={()=>setFilter(r)}>{r==='all'?t("Wszystkie"):t("Warstwa {0}", [r])}</button>)}</div><div className="inline-actions"><button className="icon-button" title={t("Importuj tekst")} aria-label={t("Importuj tekst")} onClick={importText}><Upload size={17}/></button><ImportHelp/><button className="icon-button" aria-label={t("Kopiuj tekst")} onClick={async()=>{await navigator.clipboard.writeText(project.script.map(l=>`${l.role}: ${l.text}`).join('\n'));setCopied(true);setTimeout(()=>setCopied(false),1600);}}>{copied?<Check size={17}/>:<Copy size={17}/>}</button></div></div>
 <div className="script-column-head"><span>{t("ROLA")}</span><span>{t("TEKST AFIRMACJI")}</span><span/></div>
 {lines.map((line,i)=><div className="script-line" key={line.id}><label className="role-select"><RoleBadge role={line.role}/><select aria-label={t("Rola zdania {0}", [i+1])} value={line.role} onChange={e=>update(p=>({...p,script:p.script.map(l=>l.id===line.id?{...l,role:e.target.value as Role}:l)}))}>{(['A','B','C'] as Role[]).map(r=><option key={r} value={r}>{r} · {roleLabels[r]}</option>)}</select></label><textarea aria-label={t("Zdanie {0}", [i+1])} maxLength={3000} rows={2} value={line.text} placeholder={t("Wpisz swoją afirmację…")} onChange={e=>update(p=>({...p,script:p.script.map(l=>l.id===line.id?{...l,text:e.target.value}:l)}))}/><button className="icon-button delete-line" aria-label={t("Usuń zdanie {0}", [i+1])} onClick={()=>update(p=>({...p,script:p.script.filter(l=>l.id!==line.id)}))}><Trash2 size={15}/></button></div>)}
 {!lines.length&&<div className="script-empty">{t("Tutaj zaczyna się Twoja intencja. Dodaj pierwsze zdanie.")}</div>}
 <button className="add-line" disabled={project.script.length>=500} onClick={()=>update(p=>({...p,script:[...p.script,{id:uid(),role:filter==='all'?'A':filter,text:''}]}))}><Plus size={17}/>{t("Dodaj zdanie")}</button><footer className="script-footer"><span><AlignLeft size={14}/>{project.script.length} {t(" zdań · ")}{words} {t(" słów")}</span><span>{t("około ")}{Math.max(1,Math.ceil(words/120))} {t(" min nagrania")}</span></footer></section>
 <aside className="script-guide"><div className="guide-symbol"><BookOpen size={25}/></div><span className="eyebrow">{t("TRZY PERSPEKTYWY")}</span><h2>{t("Słowa mają swoje miejsce.")}</h2>{(['A','B','C'] as Role[]).map(role=><div className="role-explanation" key={role}><RoleBadge role={role}/><div><strong>{roleLabels[role]}</strong><p>{role==='A'?t("Kim jestem i co wybieram. Zdania w pierwszej osobie, które stanowią rdzeń sesji."):role==='B'?t("Co robię i na czym się skupiam. Konkretne działania, wskazówki i deklaracje."):t("Co widzę i czuję. Obrazy, metafory oraz sceny budujące atmosferę.")}</p><span>{project.script.filter(l=>l.role===role).length} {t(" zdań w tej roli")}</span></div></div>)}<div className="guide-footnote">{t("Tryb ")}<strong>{project.mode==='forced-spell'?'Forced + Spell':project.mode==='forced'?'Forced':project.mode==='spell'?'Spell':'Classic'}</strong> {t(" określa punkt wyjścia. Każde zdanie możesz napisać po swojemu.")}</div></aside>
 </div><div className="writing-cue"><span>✧</span><p><strong>{t("Przeczytaj tekst na głos.")}</strong> {t(" Krótsze zdania i naturalne przerwy zwykle brzmią lepiej niż długa lista połączonych myśli.")}</p></div>
 <section className="session-notes"><h2>{t("Notatki do sesji")}</h2><p>{t("Opis formuły, intencje i źródła. Te pola nie trafiają do syntezy głosu.")}</p><label className="field">{t("Opis i notatki")}<textarea rows={4} maxLength={12000} value={project.notes||''} onChange={e=>update(p=>({...p,notes:e.target.value}))} placeholder={t("Twój sposób pracy, opis do publikacji, kolejne pomysły…")}/></label><label className="field">{t("Muzyka · autor / źródło")}<input maxLength={2000} value={project.musicCredit||''} onChange={e=>update(p=>({...p,musicCredit:e.target.value}))} placeholder={t("Tytuł, autor, link lub warunki wykorzystania")}/></label></section>
 </div>;
}
