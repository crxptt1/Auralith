import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {MotionConfig} from 'motion/react';
import {getLocale} from './i18n';

export const motionStorageKey='auralith-motion';
export const quickSpring={type:'spring' as const,stiffness:560,damping:38,mass:.7};
type MotionPreference='full'|'reduced';
const MotionContext=createContext({reduced:false,preference:'full' as MotionPreference,setPreference:(_value:MotionPreference)=>{}});
export function AppMotionProvider({children}:{children:ReactNode}){
 const [preference,setPreference]=useState<MotionPreference>(()=>{try{return localStorage.getItem(motionStorageKey)==='reduced'?'reduced':'full';}catch{return 'full';}});
 useEffect(()=>{document.documentElement.dataset.motion=preference;try{localStorage.setItem(motionStorageKey,preference);}catch{}},[preference]);
 return <MotionContext.Provider value={{reduced:preference==='reduced',preference,setPreference}}><MotionConfig reducedMotion={preference==='reduced'?'always':'never'} transition={quickSpring}>{children}</MotionConfig></MotionContext.Provider>;
}
export const useAppMotion=()=>useContext(MotionContext);
export function MotionSettings(){
 const {preference,setPreference}=useAppMotion();const pl=getLocale()==='pl';
 return <section className="settings-section motion-settings"><h3>{pl?'Animacje':'Motion'}</h3><p>{pl?'Szybkie, płynne przejścia. Ustawienie niezależne od systemu Windows.':'Quick, fluid transitions. This setting is independent of Windows.'}</p><div className="motion-options" role="group" aria-label={pl?'Animacje interfejsu':'Interface motion'}>{(['full','reduced'] as const).map(value=><button key={value} aria-pressed={preference===value} onClick={()=>setPreference(value)}>{value==='full'?(pl?'Pełne animacje':'Full motion'):(pl?'Ograniczone animacje':'Reduced motion')}</button>)}</div></section>;
}
