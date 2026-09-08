const fs=require('node:fs/promises');
const {EdgeTTS}=require('node-edge-tts');
async function run(){
 const [inputPath,outputPath]=process.argv.slice(2);
 const request=JSON.parse(await fs.readFile(inputPath,'utf8'));
 const tts=new EdgeTTS({voice:request.voice,lang:request.voice.slice(0,5),outputFormat:'audio-24khz-96kbitrate-mono-mp3',rate:`${request.rate>=0?'+':''}${request.rate}%`,timeout:90000});
 await tts.ttsPromise(request.text,outputPath);
}
run().then(()=>process.exit(0)).catch(error=>{process.stderr.write(String(error?.message||error));process.exit(1);});
