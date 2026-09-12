import {t, tMessage, getLocale} from '../i18n.js';
import {useEffect,useRef} from 'react';
export function buildWaveformEnvelope(peaks:number[],width:number):number[]{
  const count=Math.max(0,Math.floor(width));
  if(!count)return [];
  if(!peaks.length)return Array(count).fill(0);
  const raw=Array.from({length:count},(_,x)=>{const from=Math.floor(x/count*peaks.length);const to=Math.max(from+1,Math.ceil((x+1)/count*peaks.length));let peak=0;for(let i=from;i<to;i++)peak=Math.max(peak,peaks[i]||0);return peak;});
  return raw.map((value,index)=>(value*.5+(raw[index-1]??value)*.25+(raw[index+1]??value)*.25));
}
export function Waveform({peaks,color='--role-a',height=64,dim=false}:{peaks:number[];color?:string;height?:number;dim?:boolean}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const el=ref.current;if(!el)return;const paint=()=>{const width=el.getBoundingClientRect().width;const dpr=window.devicePixelRatio||1;if(width<1)return;el.width=Math.round(width*dpr);el.height=height*dpr;const ctx=el.getContext('2d');if(!ctx)return;ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);const ink=color.startsWith('--')?getComputedStyle(document.documentElement).getPropertyValue(color).trim():color;const center=height/2;const envelope=buildWaveformEnvelope(peaks,Math.ceil(width));const draw=(direction:1|-1)=>{ctx.beginPath();envelope.forEach((value,x)=>{const amplitude=Math.max(.65,value*(height*.4));const y=center+direction*amplitude;x?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();};ctx.globalAlpha=dim?.32:.82;ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.lineJoin='round';ctx.lineCap='round';draw(-1);draw(1);};const observer=new ResizeObserver(paint);observer.observe(el);const themeObserver=new MutationObserver(paint);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});paint();return()=>{observer.disconnect();themeObserver.disconnect();};},[peaks,color,height,dim]);
  return <canvas ref={ref} className="waveform" style={{height}} aria-label={t("Obwiednia nagrania")}/>;
}
