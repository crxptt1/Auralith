import {t, tMessage, getLocale} from '../i18n.js';
import {motion} from 'motion/react';
import {useEffect,useRef,type ReactNode} from 'react';
import {X,AudioLines,Check,AlertCircle,LoaderCircle} from 'lucide-react';
import {useAppMotion,quickSpring} from '../MotionPreferences';
import type {Role} from '../model';

export function RoleBadge({role}:{role:Role}){return <span className={`role-badge role-${role}`}>{role}</span>;}
export function Brand(){return <div className="brand"><div className="brand-mark"><AudioLines size={24} strokeWidth={1.65}/></div><div>Auralith<span>STUDIO</span></div></div>;}
export function Empty({icon,title,children,action}:{icon:ReactNode;title:string;children:ReactNode;action?:ReactNode}){return <div className="empty"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{children}</p>{action}</div>;}
export function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
  const {reduced}=useAppMotion();const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const prev=document.activeElement as HTMLElement;ref.current?.querySelector<HTMLElement>('input,button,select')?.focus();const handler=(e:KeyboardEvent)=>{
    if(e.key==='Escape'){e.preventDefault();onClose();}
    if(e.key==='Tab'){const els=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,[tabindex="0"]');if(!els?.length)return;const first=els[0],last=els[els.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  };document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);prev?.focus();};},[onClose]);
  return <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.14}} className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><motion.div initial={{opacity:0,scale:reduced?1:.975,y:reduced?0:12}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:reduced?1:.985,y:reduced?0:8}} transition={reduced?{duration:.1}:quickSpring} ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`modal ${wide?'wide':''}`}><header><h2>{title}</h2><button className="icon-button" aria-label={t("Zamknij")} onClick={onClose}><X size={19}/></button></header>{children}</motion.div></motion.div>;
}
export function Range({label,value,min,max,step=1,format,onChange}:{label:string;value:number;min:number;max:number;step?:number;format?:(n:number)=>string;onChange:(n:number)=>void}){return <label className="range-field"><span>{label}<output>{format?format(value):value}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;}
export function Toggle({checked,onChange,label}:{checked:boolean;onChange:(b:boolean)=>void;label:string}){const {reduced}=useAppMotion();return <motion.button whileTap={reduced?undefined:{scale:.94}} type="button" className={`toggle ${checked?'on':''}`} role="switch" aria-checked={checked} aria-label={label} onClick={()=>onChange(!checked)}><motion.span initial={false} animate={{x:checked?13:0}} transition={reduced?{duration:0}:quickSpring}/></motion.button>;}
export function StatusIcon({status}:{status:'pass'|'warn'|'fail'|'loading'}){return status==='loading'?<LoaderCircle className="spin" size={17}/>:status==='pass'?<Check size={17}/>:<AlertCircle size={17}/>;}
