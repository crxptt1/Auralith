import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const executablePath=process.argv[2]&&path.resolve(process.argv[2]);
const dataDir=path.resolve(`work/ultrasonic-qa-${Date.now()}`);await mkdir(dataDir,{recursive:true});
const voice=path.join(dataDir,'fixture.wav');
assert.equal(spawnSync(path.resolve('vendor/ffmpeg.exe'),['-v','error','-f','lavfi','-i','sine=frequency=1000:sample_rate=48000:duration=5','-c:a','pcm_s24le',voice],{windowsHide:true}).status,0);
const app=await electron.launch({...(executablePath?{executablePath}:{}),args:executablePath?[]:[process.cwd()],env:{...process.env,AURALITH_DATA_DIR:dataDir}});
try{
 const page=await app.firstWindow();await page.waitForSelector('.studio-main');
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const bytes=[...await readFile(voice)];
 await page.evaluate(async bytes=>{
  const a=await window.auralith.saveRecording({bytes:new Uint8Array(bytes).buffer,name:'Ultrasonic QA tone',format:'wav'});
  // Let the normal autosave create the initial project before replacing it.
  const until=Date.now()+5000;let data;do{data=await window.auralith.bootstrap();if(data.projects.length)break;await new Promise(resolve=>setTimeout(resolve,100));}while(Date.now()<until);
  const p=data.projects[0];if(!p)throw new Error('Initial project was not saved');
  await window.auralith.saveProject({...p,name:'Ultrasonic QA',duration:5,background:{kind:'none',gainDb:-18},layers:[{...a,id:crypto.randomUUID(),assetId:a.id,role:'A',gainDb:0,pan:0,speed:1,reverse:false,offset:0,muted:false,solo:false}]});
 },bytes);
 await page.reload();await page.waitForSelector('.studio-main');
 await page.getByRole('button',{name:'Ultrasonic 25 kHz',exact:true}).click();
 assert.match(await page.locator('.timeline-top').innerText(),/96 000/);
 assert.match(await page.locator('.high-frequency-note').innerText(),/96 kHz/);
 await page.getByRole('button',{name:'Near 20 kHz',exact:true}).click();assert.match(await page.locator('.timeline-top').innerText(),/48 000/);
 await page.getByRole('button',{name:'Subtle',exact:true}).click();
 await page.locator('nav button').filter({hasText:'Exports'}).click();
 await page.locator('.format-options button').filter({hasText:'MP3'}).click();
 const select=page.locator('.export-config select');await select.selectOption('ULTRASONIC');
 assert.ok(await page.locator('.format-options button').filter({hasText:'MP3'}).isDisabled());assert.match(await page.locator('.format-options .selected').innerText(),/WAV/);
 await page.locator('.export-action').click();await page.waitForFunction(()=>document.querySelectorAll('.export-row').length===1,{},{timeout:60000});
 await select.selectOption('NEAR');await page.locator('.format-options button').filter({hasText:'FLAC'}).click();
 await page.locator('.export-action').click();await page.waitForFunction(()=>document.querySelectorAll('.export-row').length===2,{},{timeout:60000});
 await page.waitForFunction(()=>document.querySelector('.save-state')?.textContent==='Saved');
 const data=await page.evaluate(()=>window.auralith.bootstrap());const results=data.projects[0].exports;
 assert.equal(data.version,'2.2.5');assert.deepEqual(results.map(r=>[r.variant,r.format,r.metrics.sampleRate,r.metrics.bits]),[['ULTRASONIC','wav',96000,24],['NEAR','flac',48000,24]]);
 assert.equal(await page.locator('.comparison-selects').count(),0,'high-frequency exports excluded from LUFS comparisons');
 await page.locator('.export-row').first().getByRole('button',{name:/Play/}).click();await page.waitForSelector('.toast');assert.match(await page.locator('.toast').innerText(),/resample/);
 await page.locator('.settings-button').click();await page.getByLabel('Interface language').selectOption('pl');await page.keyboard.press('Escape');
 await page.locator('nav button').filter({hasText:'Studio'}).click();
 for(const [width,height] of [[1440,1000],[1024,768]]){
  await app.evaluate(({BrowserWindow},{width,height})=>BrowserWindow.getAllWindows()[0].setSize(width,height),{width,height});
  await page.screenshot({path:path.join(dataDir,`studio-pl-${width}.png`)});
  assert.ok(await page.getByRole('button',{name:'Near 20 kHz',exact:true}).isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'no horizontal document overflow');
 }
 assert.deepEqual(errors,[]);console.log('PASS: 2.2.5 native IPC, both UI exports, persisted metadata, MP3 fallback, LUFS exclusions, playback warning, PL layout. Screenshots:',dataDir);
}finally{await app.evaluate(({app})=>app.exit(0));}
