import {t, tMessage, getLocale} from '../i18n.js';
import {useEffect,useRef} from 'react';
export function Waveform({peaks,color='--role-a',height=64,dim=false}:{peaks:number[];color?:string;height?:number;dim?:boolean}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const el=ref.current;if(!el)return;const paint=()=>{const width=el.getBoundingClientRect().width;const dpr=window.devicePixelRatio||1;el.width=Math.round(width*dpr);el.height=height*dpr;const ctx=el.getContext('2d');if(!ctx)return;ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);ctx.fillStyle=color.startsWith('--')?getComputedStyle(document.documentElement).getPropertyValue(color).trim():color;ctx.globalAlpha=dim?0.22:0.75;const count=Math.floor(width/4);for(let i=0;i<count;i++){const p=peaks[Math.floor(i/count*peaks.length)]??0;const h=Math.max(2,p*(height-8));ctx.beginPath();ctx.roundRect(i*4,(height-h)/2,2,h,1);ctx.fill();}};const observer=new ResizeObserver(paint);observer.observe(el);const themeObserver=new MutationObserver(paint);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});paint();return()=>{observer.disconnect();themeObserver.disconnect();};},[peaks,color,height,dim]);
  return <canvas ref={ref} className="waveform" style={{height}} aria-label={t("Obwiednia nagrania")}/>;
}
