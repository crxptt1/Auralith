import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

// Opt-in: sends only these test sentences to Microsoft's online voice service.
const executablePath=process.argv[2]&&path.resolve(process.argv[2]);
const dataDir=path.resolve('work/tts-qa-'+Date.now());
const app=await electron.launch({
 ...(executablePath?{executablePath}:{}),
 args:executablePath?[]:[process.cwd()],
 env:{...process.env,AURALITH_DATA_DIR:dataDir}
});
try{
 const page=await app.firstWindow();
 await page.waitForSelector('.studio-main');
 const voices=['pl-PL-ZofiaNeural','pl-PL-MarekNeural','en-US-GuyNeural','en-US-JennyNeural','en-GB-SoniaNeural','windows-default'];
 for(const [index,voice] of voices.entries()){
  const request={voice,rate:index%2?10:-10,text:voice.startsWith('pl-')?'To jest test głosu. Spokój & pewność <test>.':'This is a voice test. Calm & confidence <test>.',name:'TTS verification '+voice};
  const asset=await page.evaluate(request=>window.auralith.synthesize(request),request);
  assert.ok(asset.duration>0&&asset.duration<30,voice+': valid duration');
  assert.equal(asset.sampleRate,48000,voice+': 48 kHz');
  assert.equal(asset.channels,1,voice+': mono');
  assert.ok(asset.peaks.some(peak=>peak>0),voice+': audible signal');
  assert.ok(path.resolve(asset.path).startsWith(dataDir+path.sep),'isolated test library');
  const audio=await readFile(asset.path);
  assert.equal(audio.toString('ascii',0,4),'RIFF');
  assert.equal(audio.toString('ascii',8,12),'WAVE');
  assert.ok(audio.length>1000,voice+': nonempty WAV');
  console.log('PASS:',voice,asset.duration.toFixed(2)+'s',audio.length+' bytes');
 }
 const data=await page.evaluate(()=>window.auralith.bootstrap());
 assert.equal(data.assets.length,voices.length,'all generated recordings saved');
 const saved=JSON.parse(await readFile(path.join(dataDir,'assets.json'),'utf8'));
 assert.deepEqual(saved.map(asset=>asset.id),data.assets.map(asset=>asset.id),'library persisted to disk');
 console.log('PASS: synthesis IPC, worker, PCM conversion and library persistence');
}finally{
 await app.evaluate(({app})=>app.exit(0));
}
