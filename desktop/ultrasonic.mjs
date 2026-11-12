// DSB-SC preserves the speech waveform in two sidebands, without an empty carrier.
export function modulationFilter(carrierHz,sampleRate){
 return `aresample=96000,firequalizer=gain='if(between(f,300,3000),0,-120)':delay=0.05:accuracy=5:zero_phase=on,aeval=exprs='val(0)*cos(2*PI*${carrierHz}*t)|val(1)*cos(2*PI*${carrierHz}*t)',aresample=${sampleRate}:filter_size=128`;
}

// Measure interpolated peaks over the entire band, including energy above 24 kHz.
export async function fullBandPeak(file,exec){
 const log=await exec(['-i',file,'-af','aresample=192000:filter_size=128,astats=metadata=0:reset=0','-f','null','-']);
 const value=Number([...log.matchAll(/Peak level dB:\s*(-?[\d.]+|-inf)/g)].at(-1)?.[1]);
 if(!Number.isFinite(value))throw new Error('Brak mierzalnego sygnału wysokoczęstotliwościowego.');
 return value;
}

export async function modulateVoices({voices,nominal,profile,job,exec,pcm}){
 const filter=modulationFilter(profile.carrierHz,profile.sampleRate);
 const reference=`${job}/ultrasonic-reference.wav`,shifted=`${job}/ultrasonic-shifted.wav`,output=`${job}/ultrasonic-voices.wav`;
 await exec(['-i',nominal,'-af',filter,...pcm,reference]);
 // A rejected input band must never be amplified back into a large sideband.
 const referencePeak=Math.max(await fullBandPeak(reference,exec),await fullBandPeak(nominal,exec)-6.0206);
 await exec(['-i',voices,'-af',`${filter},volume=${Math.min(0,-24-referencePeak)}dB`,...pcm,shifted]);
 const peak=await fullBandPeak(shifted,exec);
 await exec(['-i',shifted,'-af',`volume=${Math.min(0,-24-peak)}dB`,...pcm,output]);
 return output;
}
