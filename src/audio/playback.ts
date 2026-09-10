/** Monitor position is perceptual: finer gain adjustment near silence. */
export function playbackGain(position:number):number {return Number.isFinite(position)?Math.max(0,Math.min(1,position))**2:0;}
