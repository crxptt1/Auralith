const {app,BrowserWindow,ipcMain,dialog,protocol,net,shell,session}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const crypto=require('node:crypto');
const {createStore,atomicWrite}=require('./storage.cjs');
const AdmZip=require('adm-zip');
const {validateSupportUrl}=require('./support.cjs');
const {spawn}=require('node:child_process');

protocol.registerSchemesAsPrivileged([{scheme:'auralith',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
if(process.env.AURALITH_DATA_DIR)app.setPath('userData',path.resolve(process.env.AURALITH_DATA_DIR));
const instanceLock=app.requestSingleInstanceLock();
if(!instanceLock)app.exit(0);
let exportRemovalBusy=false,updates,win,store,engine,model,i18n,assets=[],renderJob=null,ttsBusy=false,ttsProcess=null,confirmedClose=false;
const media=new Map();
const text=s=>i18n?i18n.tMessage(s):s;
const dialogOptions=options=>({...options,...(options.title?{title:text(options.title)}:{}),...(options.message?{message:text(options.message)}:{}),...(options.detail?{detail:text(options.detail)}:{}),...(options.buttons?{buttons:options.buttons.map(text)}:{}),...(options.filters?{filters:options.filters.map(f=>({...f,name:text(f.name)}))}:{})});
const openDialog=options=>dialog.showOpenDialog(win,dialogOptions(options));
const saveDialog=options=>dialog.showSaveDialog(win,dialogOptions(options));
const messageDialog=options=>dialog.showMessageBox(win,dialogOptions(options));
const ffmpegPath=app.isPackaged?path.join(process.resourcesPath,'ffmpeg.exe'):path.join(__dirname,'../vendor/ffmpeg.exe');
const safeName=s=>String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'Nagranie';
function mediaUrl(file){const key=crypto.createHash('sha256').update(file).digest('hex');media.set(key,file);return `auralith://audio/${key}`;}
function hydrateAsset(a){return {...a,url:mediaUrl(a.path)};}
function hydrateProject(p){return {...p,layers:p.layers.map(l=>({...l,url:mediaUrl(l.path)})),exports:(p.exports||[]).map(r=>({...r,url:mediaUrl(r.path)}))};}
function requireManaged(file){if(!store.isManaged(file))throw new Error('Ten plik nie należy do biblioteki aplikacji.');return file;}
function validateManagedProject(raw){const p=model.validateProject(raw);for(const l of p.layers)requireManaged(l.path);if(p.background.kind==='file')requireManaged(p.background.path);for(const r of p.exports||[])requireManaged(r.path);return p;}
function sendProgress(event){if(win&&!win.isDestroyed())win.webContents.send('audio:progress',event);}
function handle(channel,fn){ipcMain.handle(channel,async(event,...args)=>{if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame)throw new Error('Niedozwolone źródło żądania.');return fn(...args);});}
async function addAsset(file,name){
 const stat=await fs.stat(file);if(stat.size>1024*1024*1024)throw new Error('Pojedyncze nagranie może mieć do 1 GB.');
 const info=await engine.probe(file);if(!Number.isFinite(info.duration)||info.duration<=0||info.duration>600)throw new Error('Pojedyncze nagranie może mieć do 10 minut. Dłuższy materiał podziel na części; sesja może trwać do godziny.');
 const id=crypto.randomUUID();const extension=/^\.[a-z0-9]{1,8}$/i.test(path.extname(file))?path.extname(file):'.audio';
 const destination=store.managedPath(id+extension);
 await fs.copyFile(file,destination);
 try{const peaks=await engine.waveform(destination);const a=hydrateAsset({id,name:safeName(name||path.basename(file)),path:destination,duration:info.duration,peaks,sampleRate:info.sampleRate,channels:info.channels});assets.push(a);await store.saveAssets(assets);return a;}catch(error){assets=assets.filter(a=>a.id!==id);await fs.rm(destination,{force:true});throw error;}
}
async function importAudio(){
 const result=await openDialog({title:'Dodaj nagrania do biblioteki',properties:['openFile','multiSelections'],filters:[{name:'Audio',extensions:['wav','mp3','flac','m4a','aac','ogg','opus','webm','mp4','mov']},{name:'Wszystkie pliki',extensions:['*']}]});
 if(result.canceled)return [];const added=[];try{for(const file of result.filePaths)added.push(await addAsset(file));return added;}catch(error){const ids=new Set(added.map(a=>a.id));assets=assets.filter(a=>!ids.has(a.id));await store.saveAssets(assets);await Promise.all(added.map(a=>fs.rm(a.path,{force:true})));throw error;}
}
async function exportProject(raw){
 const p=validateManagedProject(raw);const result=await saveDialog({title:'Zapisz przenośny projekt z nagraniami',defaultPath:`${safeName(p.name)}.auralith`,filters:[{name:'Projekt Auralith',extensions:['auralith']}]});
 if(result.canceled||!result.filePath)return false;
 const zip=new AdmZip();const portable=structuredClone(p);portable.exports=[];portable.comparisons=[];const unique=new Map();
 for(const l of portable.layers)unique.set(l.path,l.name);if(portable.background.kind==='file')unique.set(portable.background.path,portable.background.name||'Tło');
 const manifest=[];let total=0;for(const [file,name] of unique){const bytes=await fs.readFile(file);total+=bytes.length;if(total>1024*1024*1024)throw new Error('Przenośny projekt może mieć do 1 GB nagrań.');const key=`audio/${crypto.randomUUID()}${path.extname(file)}`;zip.addFile(key,bytes);manifest.push({key,name});for(const l of portable.layers)if(l.path===file){l.path=key;l.url='';}if(portable.background.path===file)portable.background.path=key;}
 zip.addFile('project.json',Buffer.from(JSON.stringify({project:portable,assets:manifest}),'utf8'));await atomicWrite(result.filePath,zip.toBuffer());return true;
}
async function importProject(){
 const result=await openDialog({title:'Otwórz projekt',properties:['openFile'],filters:[{name:'Projekt Auralith / poprzednia wersja',extensions:['auralith','aurelith','json']}]});
 if(result.canceled)return null;const file=result.filePaths[0];const stat=await fs.stat(file);if(stat.size>1100*1024*1024)throw new Error('Projekt jest zbyt duży.');const bytes=await fs.readFile(file);let p;
 if(bytes[0]===0x50&&bytes[1]===0x4b){
  const zip=new AdmZip(bytes);const entry=zip.getEntry('project.json');if(!entry||entry.header.size>10*1024*1024)throw new Error('Uszkodzony projekt.');
  const bundle=JSON.parse(entry.getData().toString('utf8'));p=model.validateProject(bundle.project);if(!Array.isArray(bundle.assets)||bundle.assets.length>33)throw new Error('Nieprawidłowa biblioteka projektu.');
  let total=0;const map=new Map();const imported=[];
  for(const item of bundle.assets){if(typeof item.key!=='string'||!/^audio\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]{1,8}$/.test(item.key))throw new Error('Nieprawidłowa ścieżka nagrania.');const mediaEntry=zip.getEntry(item.key);if(!mediaEntry)throw new Error('W projekcie brakuje nagrania.');total+=mediaEntry.header.size;if(total>1024*1024*1024)throw new Error('Za duża biblioteka projektu.');const temporary=path.join(store.work,crypto.randomUUID()+path.extname(item.key));try{await fs.writeFile(temporary,mediaEntry.getData());const a=await addAsset(temporary,item.name);map.set(item.key,a);imported.push(a);}finally{await fs.rm(temporary,{force:true});}}
  p.layers=p.layers.map(l=>{const a=map.get(l.path);if(!a)throw new Error('Nie odnaleziono nagrania warstwy.');return {...l,assetId:a.id,path:a.path,url:a.url,peaks:a.peaks,duration:a.duration};});
  if(p.background.kind==='file'){const a=map.get(p.background.path);if(!a)throw new Error('Brak nagrania tła.');p.background.path=a.path;p.background.name=a.name;}
  p.exports=[];
 }else{if(bytes.length>10*1024*1024)throw new Error('Plik JSON projektu jest zbyt duży.');p=model.migrateProject(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')));p.layers=p.layers.filter(l=>store.isManaged(l.path));if(p.background.kind==='file'&&!store.isManaged(p.background.path))p.background={kind:'brown',gainDb:-18};p.exports=[];}
 p.comparisons=[];p.id=crypto.randomUUID();p.name=`${p.name.slice(0,190)} · import`;p.createdAt=new Date().toISOString();await store.saveProject(validateManagedProject(p));return hydrateProject(p);
}
async function speechProcess(program,args,timeout=120000,extraEnv={}){
 await new Promise((resolve,reject)=>{const child=spawn(program,args,{windowsHide:true,env:{...process.env,...extraEnv}});ttsProcess=child;let errors='';let expired=false;child.stderr.on('data',b=>errors=(errors+b.toString()).slice(-4000));const timer=setTimeout(()=>{expired=true;child.kill();},timeout);child.once('error',error=>{clearTimeout(timer);if(ttsProcess===child)ttsProcess=null;reject(error);});child.once('close',code=>{clearTimeout(timer);if(ttsProcess===child)ttsProcess=null;code===0?resolve():reject(new Error(expired?'Voice generation timed out.':errors||'Voice generation cancelled or failed.'));});});
}
async function synthesize(request){
 if(ttsBusy)throw new Error('Poczekaj na zakończenie generowania głosu.');
 if(typeof request?.text!=='string'||!request.text.trim()||request.text.length>12000)throw new Error('Do wygenerowania wybierz od 1 do 12 000 znaków.');
 if(!['pl-PL-MarekNeural','pl-PL-ZofiaNeural','en-US-GuyNeural','en-US-JennyNeural','en-GB-SoniaNeural','windows-default'].includes(request.voice))throw new Error('Nieobsługiwany głos.');
 if(!Number.isFinite(request.rate)||request.rate< -40||request.rate>40)throw new Error('Nieprawidłowe tempo.');
 ttsBusy=true;const file=path.join(store.work,crypto.randomUUID()+(request.voice==='windows-default'?'.wav':'.mp3'));
 try{
  if(request.voice==='windows-default'){
   const textFile=file+'.txt';await fs.writeFile(textFile,request.text,'utf8');
   try{await speechProcess('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked','desktop','speak.ps1'):path.join(__dirname,'speak.ps1'),'-TextPath',textFile,'-OutputPath',file,'-Rate',String(Math.round(request.rate/10))],180000);}finally{await fs.rm(textFile,{force:true});}
  }else{const input=file+'.request.json';await fs.writeFile(input,JSON.stringify(request));try{await speechProcess(process.execPath,[path.join(__dirname,'tts-worker.cjs'),input,file],120000,{ELECTRON_RUN_AS_NODE:'1'});}finally{await fs.rm(input,{force:true});}}
  const wave=file+'.pcm.wav';
  try{await speechProcess(ffmpegPath,['-hide_banner','-nostdin','-loglevel','error','-y','-i',file,'-map','0:a:0','-ar','48000','-ac','1','-c:a','pcm_s24le',wave]);return await addAsset(wave,request.name||'Generated voice');}finally{await fs.rm(wave,{force:true});}
 }catch(error){throw new Error(request.voice==='windows-default'?String(error.message):'Usługa głosu online jest niedostępna. Sprawdź internet lub wybierz głos Windows offline. '+String(error.message).slice(0,160));}
 finally{ttsBusy=false;await fs.rm(file,{force:true});}
}
async function render(request){
 if(renderJob)throw new Error('Inny render już trwa.');const p=validateManagedProject(request?.project);if(!['wav','flac','mp3'].includes(request.format))throw new Error('Nieobsługiwany format.');
 const id=crypto.randomUUID();const preview=!!request.preview;const duration=preview?Math.min(p.duration,30):p.duration;
 const outputPath=path.join(store.renders,`${safeName(p.name)}_${p.variant}_${preview?'preview_':''}${id.slice(0,8)}.${request.format}`);
 const controller=new AbortController();renderJob=controller;
 try{const result=await engine.render({...p,duration,layers:p.layers.map(l=>({...l,offset:Math.min(l.offset,duration)})),format:request.format,outputPath,preview},{signal:controller.signal,onProgress:sendProgress});const completed={...result,id,url:mediaUrl(result.path)};if(!preview)await atomicWrite(outputPath+'.json',JSON.stringify({appVersion:app.getVersion(),createdAt:new Date().toISOString(),project:{...p,exports:[],comparisons:[]},result:completed},null,2));return completed;}
 finally{renderJob=null;}
}
async function register(){
 handle('updates:status',()=>updates.status());
 handle('updates:enabled',value=>updates.setEnabled(value));
 handle('updates:check',()=>updates.check());
 handle('updates:download',()=>updates.download());
 handle('updates:install',()=>{if(renderJob||ttsBusy||exportRemovalBusy||updates.status().phase!=='downloaded')throw new Error('Update cannot be installed now.');confirmedClose=true;updates.install();});
 handle('support:open',url=>shell.openExternal(validateSupportUrl(url)));
 handle('app:language',language=>{if(!['en','pl'].includes(language))throw new Error('Unsupported language.');i18n.setLocale(language);});
 handle('app:bootstrap',async()=>{const raw=await store.listProjects();const projects=[];for(const p of raw){try{projects.push(hydrateProject(validateManagedProject(p)));}catch{}}return {projects,assets:assets.map(hydrateAsset),version:app.getVersion(),dataPath:store.root};});
 handle('project:save',async p=>hydrateProject(await store.saveProject(validateManagedProject(p))));
 handle('project:export',exportProject);handle('project:import',importProject);handle('audio:import',importAudio);
 handle('text:import',async()=>{const r=await openDialog({title:'Importuj tekst afirmacji',properties:['openFile'],filters:[{name:'Tekst',extensions:['txt','md']}]});if(r.canceled)return null;const stat=await fs.stat(r.filePaths[0]);if(stat.size>1024*1024)throw new Error('Plik tekstowy może mieć do 1 MB.');return fs.readFile(r.filePaths[0],'utf8');});
 handle('export:remove',async request=>{if(exportRemovalBusy)throw new Error('Export removal is already running.');exportRemovalBusy=true;try{if(renderJob||ttsBusy)throw new Error('Finish audio processing first.');if(typeof request?.exportId!=='string'||typeof request?.trash!=='boolean')throw new Error('Invalid export removal.');const p=validateManagedProject(request.project);const found=p.exports.find(r=>r.id===request.exportId);if(!found)throw new Error('Export not found.');let reportRetained=false;if(request.trash){const {trashRenderedExport}=require('./export-removal.cjs');({reportRetained}=await trashRenderedExport({renders:store.renders,project:p,exportId:request.exportId,projects:[p,...(await store.listProjects()).filter(x=>x.id!==p.id)],trashItem:file=>shell.trashItem(file)}));}p.exports=p.exports.filter(r=>r.id!==request.exportId);p.comparisons=p.comparisons?.filter(c=>c.firstId!==request.exportId&&c.secondId!==request.exportId);return {project:hydrateProject(await store.saveProject(p)),reportRetained};}finally{exportRemovalBusy=false;}});
 handle('audio:remove',async id=>{if(typeof id!=='string'||!assets.some(a=>a.id===id))throw new Error('Recording not found.');const next=assets.filter(a=>a.id!==id);await store.saveAssets(next);assets=assets.filter(a=>a.id!==id);});
 handle('audio:synthesize',synthesize);
 handle('audio:recording',async request=>{if(!(request?.bytes instanceof ArrayBuffer)||!request.bytes.byteLength||request.bytes.byteLength>150*1024*1024)throw new Error('Nieprawidłowe nagranie.');const temporary=path.join(store.work,crypto.randomUUID()+(request.format==='wav'?'.wav':'.webm'));try{await fs.writeFile(temporary,Buffer.from(request.bytes));return await addAsset(temporary,request.name||'Nagranie mikrofonu');}finally{await fs.rm(temporary,{force:true});}});
 handle('audio:render',render);handle('audio:cancel',()=>{renderJob?.abort();});
 handle('file:reveal',file=>{requireManaged(file);shell.showItemInFolder(file);});
 handle('file:export',async file=>{requireManaged(file);const r=await saveDialog({title:'Zapisz nagranie',defaultPath:path.basename(file)});if(r.canceled||!r.filePath)return false;if(path.resolve(file)!==path.resolve(r.filePath))await fs.copyFile(file,r.filePath);try{await fs.copyFile(file+'.json',r.filePath+'.json');}catch(error){if(error.code!=='ENOENT')throw error;}return true;});
 ipcMain.on('window:control',(event,action)=>{if(event.sender!==win?.webContents)return;if(action==='minimize')win.minimize();else if(action==='maximize')win.isMaximized()?win.unmaximize():win.maximize();else if(action==='close')win.close();else if(action==='close-saved'){confirmedClose=true;win.close();}});
 protocol.handle('auralith',request=>{const url=new URL(request.url);const file=media.get(url.pathname.slice(1));if(url.hostname!=='audio'||!file||!store.isManaged(file))return new Response('Not found',{status:404});return net.fetch(pathToFileURL(file).toString(),{headers:request.headers});});
}
async function createWindow(){
 win=new BrowserWindow({width:1480,height:960,minWidth:1000,minHeight:700,show:false,frame:false,backgroundColor:'#dce5df',title:'Auralith Studio',icon:app.isPackaged?path.join(process.resourcesPath,'icon.png'):path.join(__dirname,'../build/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{if(url!==win.webContents.getURL())event.preventDefault();});
 win.on('close',async event=>{if(exportRemovalBusy){event.preventDefault();return;}if(confirmedClose)return;event.preventDefault();if(renderJob||ttsBusy){const r=await messageDialog({type:'question',buttons:['Zostań','Zamknij aplikację'],defaultId:0,cancelId:0,message:'Trwa przetwarzanie audio. Zamknąć aplikację?',detail:'Bieżący render zostanie anulowany.'});if(r.response===0)return;renderJob?.abort();ttsProcess?.kill();}win.webContents.send('app:close-request');});
 win.once('ready-to-show',()=>win.show());
 if(process.env.AURALITH_DEV_URL)await win.loadURL(process.env.AURALITH_DEV_URL);else await win.loadFile(path.join(__dirname,'../dist/index.html'));
}
app.whenReady().then(async()=>{
 i18n=await import('./i18n.mjs');model=await import('./model.mjs');store=createStore(app.getPath('userData'));await store.init();const {createAudioEngine}=await import('./audio.mjs');engine=createAudioEngine({ffmpegPath,workDir:store.work});assets=(await store.listAssets()).filter(a=>a&&typeof a.id==='string'&&typeof a.name==='string'&&a.name.length<=300&&Number.isFinite(a.duration)&&a.duration>0&&Array.isArray(a.peaks)&&a.peaks.length<=2000&&a.peaks.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)&&store.isManaged(a.path));
 session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===win?.webContents&&permission==='media'&&!(details.mediaTypes||[]).includes('video')));
 session.defaultSession.setPermissionCheckHandler((contents,permission)=>contents===win?.webContents&&permission==='media');
 const {createUpdates}=require('./updates.cjs');const {autoUpdater}=require('electron-updater');
 let checksEnabled=true;try{checksEnabled=JSON.parse(await fs.readFile(path.join(store.root,'updates.json'),'utf8')).enabled!==false;}catch{}
 updates=createUpdates({updater:autoUpdater,repository:require('./update-config.json'),supported:app.isPackaged&&!process.env.PORTABLE_EXECUTABLE_FILE,enabled:checksEnabled,persist:value=>atomicWrite(path.join(store.root,'updates.json'),JSON.stringify({enabled:value})),notify:status=>{if(win&&!win.isDestroyed())win.webContents.send('updates:status',status);}});
 await register();await createWindow();
 const updateTimer=setTimeout(()=>{if(updates.status().enabled)void updates.check();},15000);updateTimer.unref();
}).catch(error=>{dialog.showErrorBox('Nie udało się uruchomić Auralith Studio',String(error.stack||error));app.exit(1);});
app.on('window-all-closed',()=>{renderJob?.abort();ttsProcess?.kill();app.quit();});
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});

