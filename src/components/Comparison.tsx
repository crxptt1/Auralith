import {t, tMessage, getLocale} from '../i18n.js';
import {useEffect,useRef,useState} from 'react';
import {Play,Pause,Shuffle,Check} from 'lucide-react';
import {type Project,type ComparisonResult,uid} from '../model';

export function Comparison({project,update}:{project:Project;update:(fn:(p:Project)=>Project)=>void}){
 const eligible=project.exports.filter(r=>Number.isFinite(r.metrics.integratedLufs));
 const [first,setFirst]=useState('');const [second,setSecond]=useState('');
 const [order,setOrder]=useState<[string,string]|null>(null);const [votes,setVotes]=useState<string[]>([]);const [heard,setHeard]=useState<string[]>([]);const [playing,setPlaying]=useState<string|null>(null);const [error,setError]=useState('');const [volume,setVolume]=useState(.3);
 const player=useRef<HTMLAudioElement>(null);
 const a=eligible.find(r=>r.id===first)||eligible.at(-2);const b=eligible.find(r=>r.id===second)||eligible.at(-1);
 const canStart=a&&b&&a.id!==b.id;
 useEffect(()=>()=>{player.current?.pause();},[]);
 function shuffle(){if(!a||!b)return;const bit=crypto.getRandomValues(new Uint8Array(1))[0]&1;setOrder(bit?[a.id,b.id]:[b.id,a.id]);setHeard([]);setPlaying(null);}
 function start(){if(!a||!b)return;setFirst(a.id);setSecond(b.id);player.current?.pause();setVotes([]);setError('');shuffle();}
 async function listen(id:string){const el=player.current;const r=eligible.find(x=>x.id===id);if(!el||!r||!a||!b)return;el.pause();const target=Math.min(a.metrics.integratedLufs!,b.metrics.integratedLufs!);el.volume=volume*Math.pow(10,(target-r.metrics.integratedLufs!)/20);el.src=r.url;try{await el.play();setPlaying(id);setHeard(prev=>[...new Set([...prev,id])]);}catch(error){if(error instanceof DOMException&&error.name==='AbortError')return;setError(t("Nie można odtworzyć tego pliku. Wybierz dostępny eksport."));}}
 function vote(id:string){if(!a||!b)return;player.current?.pause();const next=[...votes,id];setVotes(next);if(next.length===10){const result:ComparisonResult={id:uid(),createdAt:new Date().toISOString(),firstId:a.id,secondId:b.id,firstVotes:next.filter(v=>v===a.id).length,secondVotes:next.filter(v=>v===b.id).length,ties:next.filter(v=>v==='tie').length};update(p=>({...p,comparisons:[...(p.comparisons||[]),result]}));setOrder(null);}else shuffle();}
 const label=(r:typeof eligible[number])=>`${r.variant} · ${r.format.toUpperCase()} · ${new Date(r.createdAt).toLocaleString(getLocale())} · ${r.id.slice(0,4)}`;
 return <section className="comparison-panel"><div className="subheading"><div><span className="eyebrow">{t("PORÓWNANIE ODSŁUCHOWE")}</span><h2>{t("Wybierz uszami.")}</h2></div><Shuffle size={22}/></div><p>{t("Dziesięć prób z losową kolejnością A/B i ukrytymi nazwami. Wyrównujemy LUFS obu plików przez ściszenie głośniejszego. To ocena brzmienia i komfortu.")}</p>
 {eligible.length<2?<p className="inspector-hint">{t("Wyeksportuj co najmniej dwa warianty, aby rozpocząć porównanie.")}</p>:<>
 <div className="comparison-selects"><label className="field">{t("Pierwszy plik")}<select value={a?.id} disabled={!!order} onChange={e=>setFirst(e.target.value)}>{eligible.map(r=><option key={r.id} value={r.id}>{label(r)}</option>)}</select></label><label className="field">{t("Drugi plik")}<select value={b?.id} disabled={!!order} onChange={e=>setSecond(e.target.value)}>{eligible.map(r=><option key={r.id} value={r.id}>{label(r)}</option>)}</select></label></div>
 {order?<><div className="comparison-progress"><span>{t("Próba ")}{votes.length+1} {t(" z 10")}</span><progress max={10} value={votes.length}/><button className="text-button" onClick={()=>{player.current?.pause();setOrder(null);}}>{t("Zakończ bez zapisu")}</button></div><div className="comparison-choices">{order.map((id,i)=><div key={i}><button className="button ghost" onClick={()=>void listen(id)}><Play size={17}/>{t("Posłuchaj ")}{i===0?'A':'B'}{heard.includes(id)&&<Check size={14}/>}</button><button className="button primary" disabled={heard.length<2} onClick={()=>vote(id)}>{t("Wybieram ")}{i===0?'A':'B'}</button></div>)}</div><div className="comparison-controls"><button className="button small ghost" onClick={()=>player.current?.pause()}><Pause size={14}/>{t("Pauza")}</button><label>{t("Głośność")}<input aria-label={t("Głośność porównania")} type="range" min={0} max={1} step={.01} value={volume} onChange={e=>{const v=Number(e.target.value);setVolume(v);if(player.current&&playing){const r=eligible.find(x=>x.id===playing)!;player.current.volume=v*Math.pow(10,(Math.min(a!.metrics.integratedLufs!,b!.metrics.integratedLufs!)-r.metrics.integratedLufs!)/20);}}}/></label><button className="text-button" disabled={heard.length<2} onClick={()=>vote('tie')}>{t("Bez preferencji")}</button></div></>:<button className="button ghost" disabled={!canStart} onClick={start}><Shuffle size={16}/>{t("Rozpocznij porównanie")}</button>}
 {error&&<p role="alert">{tMessage(error)}</p>}
 </>}
 {(project.comparisons||[]).slice(-3).reverse().map(c=>{const one=project.exports.find(r=>r.id===c.firstId),two=project.exports.find(r=>r.id===c.secondId);return <div className="comparison-result" key={c.id}><strong>{new Date(c.createdAt).toLocaleDateString(getLocale())} {t(" · 10 prób")}</strong><span>{one?.variant||t("Pierwszy")} ({c.firstId.slice(0,4)}): {c.firstVotes} · {two?.variant||t("Drugi")} ({c.secondId.slice(0,4)}): {c.secondVotes} {t(" · bez preferencji: ")}{c.ties}</span></div>;})}
 <audio ref={player} onPause={()=>setPlaying(null)} onEnded={()=>setPlaying(null)}/>
 </section>;
}
