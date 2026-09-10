import {useState} from 'react';
import {motion} from 'motion/react';
import {ChevronDown,RotateCcw,Volume2,VolumeX,Info} from 'lucide-react';
import {getLocale,t} from '../i18n.js';
import {type Project,db} from '../model';
import {Range,Toggle} from './Primitives';
import {useAppMotion,quickSpring} from '../MotionPreferences';
import './background-controls.css';

export function BackgroundControls({project,update}:{project:Project;update:(fn:(p:Project)=>Project)=>void}){
  const [advanced,setAdvanced]=useState(false);
  const {reduced}=useAppMotion();
  const b=project.background;
  const copy=(pl:string,en:string)=>getLocale()==='pl'?pl:en;
  const edit=(patch:Partial<Project['background']>)=>update(p=>({...p,background:{...p.background,...patch}}));
  return <div className="inspector-block background-controls">
    <h3>{copy('Ustawienia tła','Background settings')}</h3>
    {b.kind==='none'?<p className="inspector-hint">{copy('Wybierz szum lub dodaj muzykę, aby edytować tło.','Choose noise or add music to edit the background.')}</p>:<>
      <div className="background-control-buttons"><button className={`button small ghost ${b.muted?'active':''}`} aria-pressed={!!b.muted} onClick={()=>edit({muted:!b.muted})}>{b.muted?<VolumeX size={14}/>:<Volume2 size={14}/>} {t('Wycisz')}</button><button className={`button small ghost ${b.solo?'active':''}`} aria-pressed={!!b.solo} onClick={()=>edit({solo:!b.solo})}>Solo</button></div>
      <Range label={t('Poziom atmosfery')} value={b.gainDb} min={-42} max={-6} format={db} onChange={gainDb=>edit({gainDb})}/>
      <button className="disclosure" aria-expanded={advanced} aria-controls="background-advanced" onClick={()=>setAdvanced(!advanced)}>{copy('Zaawansowane ustawienia','Advanced settings')}<ChevronDown size={14} style={{transform:advanced?'rotate(180deg)':undefined}}/></button>
      {advanced&&<motion.div id="background-advanced" initial={{opacity:0,y:reduced?0:6}} animate={{opacity:1,y:0}} transition={reduced?{duration:.1}:quickSpring}>
        <p className="background-advice"><Info size={14}/><span>{copy('Filtry i przejścia zmieniają charakter tła. Zacznij od małych zmian i odsłuchaj miks.','Filters and fades shape the background. Start with small changes and listen to the mix.')}</span></p>
        <Range label={copy('Odetnij niskie częstotliwości','Low-frequency cutoff')} value={b.highpassHz??55} min={20} max={2000} step={1} format={n=>`${n} Hz`} onChange={highpassHz=>edit({highpassHz,lowpassHz:Math.max(b.lowpassHz??10000,highpassHz+1)})}/>
        <Range label={copy('Odetnij wysokie częstotliwości','High-frequency cutoff')} value={b.lowpassHz??10000} min={1000} max={20000} step={1} format={n=>`${n} Hz`} onChange={lowpassHz=>edit({lowpassHz,highpassHz:Math.min(b.highpassHz??55,lowpassHz-1)})}/>
        <Range label={copy('Łagodne wejście','Fade in')} value={b.fadeIn??.015} min={0} max={10} step={.005} format={n=>`${n.toFixed(3)} s`} onChange={fadeIn=>edit({fadeIn})}/>
        <Range label={copy('Łagodne wyjście','Fade out')} value={b.fadeOut??.025} min={0} max={10} step={.005} format={n=>`${n.toFixed(3)} s`} onChange={fadeOut=>edit({fadeOut})}/>
        <Range label={t('Panorama')} value={b.pan??0} min={-1} max={1} step={.01} format={n=>n===0?t('Środek'):`${n<0?'L':'R'} ${Math.round(Math.abs(n)*100)}%`} onChange={pan=>edit({pan})}/>
        {b.kind==='file'&&<><Range label={t('Tempo · zachowaj ton')} value={b.speed??1} min={.5} max={2} step={.05} format={n=>`${n.toFixed(2)}×`} onChange={speed=>edit({speed})}/><div className="toggle-row"><div>{t('Odtwarzaj od tyłu')}</div><Toggle label={t('Odtwarzaj od tyłu')} checked={b.reverse??false} onChange={reverse=>edit({reverse})}/></div></>}
        <button className="button small ghost background-reset" onClick={()=>edit({highpassHz:55,lowpassHz:10000,fadeIn:.015,fadeOut:.025,pan:0,speed:1,reverse:false})}><RotateCcw size={13}/>{copy('Przywróć ustawienia zaawansowane','Reset advanced settings')}</button>
      </motion.div>}
    </>}
  </div>;
}
