function createUpdates({updater,repository,supported,enabled=true,persist=async()=>{},notify=()=>{}}){
 const valid=repository&&/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(repository.owner)&&/^[a-zA-Z0-9_.-]{1,100}$/.test(repository.repo)&&!['.','..'].includes(repository.repo);
 const ready=valid&&supported;
 let state={phase:!valid?'unconfigured':!supported?'unsupported':'idle',enabled,version:'',progress:0};
 const send=patch=>{state={...state,...patch};notify({...state});};
 if(ready){
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
  updater.setFeedURL({provider:'github',owner:repository.owner,repo:repository.repo,private:false});
  updater.on('checking-for-update',()=>send({phase:'checking'}));
  updater.on('update-available',info=>send({phase:'available',version:info.version}));
  updater.on('update-not-available',()=>send({phase:'current'}));
  updater.on('download-progress',info=>send({phase:'downloading',progress:Math.max(0,Math.min(100,info.percent||0))}));
  updater.on('update-downloaded',info=>send({phase:'downloaded',version:info.version,progress:100}));
  updater.on('error',()=>send({phase:'error'}));
 }
 return {
  status:()=>({...state}),
  async setEnabled(value){if(typeof value!=='boolean')throw new Error('Invalid update preference.');await persist(value);send({enabled:value});},
  async check(){if(!ready||['checking','downloading','downloaded','available'].includes(state.phase))return;send({phase:'checking'});try{await updater.checkForUpdates();}catch{send({phase:'error'});}},
  async download(){if(!ready||state.phase!=='available')return;send({phase:'downloading',progress:0});try{await updater.downloadUpdate();}catch{send({phase:'error'});}},
  install(){if(!ready||state.phase!=='downloaded')throw new Error('No downloaded update.');updater.quitAndInstall(false,true);}
 };
}
module.exports={createUpdates};
