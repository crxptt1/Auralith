import {t, tMessage, getLocale} from '../i18n.js';
import {motion} from 'motion/react';
import {useAppMotion,quickSpring} from '../MotionPreferences';
import {Droplets,Contrast} from 'lucide-react';
export function MaterialSwitch({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const {reduced:reduce}=useAppMotion();
 return <div className="material-switch" role="group" aria-label={t("Materiał interfejsu")}><motion.span className="material-lens" initial={false} animate={{x:value==='focus'?'100%':'0%'}} transition={reduce?{duration:0}:quickSpring}/><button aria-pressed={value==='liquid'} onClick={()=>onChange('liquid')}><Droplets size={14}/><span>Liquid Glass</span></button><button aria-pressed={value==='focus'} onClick={()=>onChange('focus')}><Contrast size={14}/><span>Focus</span></button></div>;
}
