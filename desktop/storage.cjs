const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');

function validId(id){if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw new Error('Nieprawidłowy identyfikator.');return id;}
async function atomicWrite(file,content){
 const temporary=`${file}.${crypto.randomUUID()}.tmp`;
 try{await fs.writeFile(temporary,content);await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true}).catch(()=>{});}
}
function createStore(root){
 root=path.resolve(root);
 const dirs=Object.fromEntries(['projects','assets','renders','work'].map(name=>[name,path.join(root,name)]));
 const queues=new Map();
 let assetsQueue=Promise.resolve();
 function isManaged(file){if(typeof file!=='string')return false;const resolved=path.resolve(file);return ['assets','renders'].some(k=>{const rel=path.relative(dirs[k],resolved);return rel!==''&&!rel.startsWith('..')&&!path.isAbsolute(rel);});}
 return {root,...dirs,isManaged,
  async init(){await Promise.all(Object.values(dirs).map(dir=>fs.mkdir(dir,{recursive:true})));},
  managedPath(name){validId(path.parse(name).name);if(name!==path.basename(name)||!/^\.[a-z0-9]{1,8}$/i.test(path.extname(name)))throw new Error('Nieprawidłowa nazwa pliku.');return path.join(dirs.assets,name);},
  async listProjects(){
   const entries=await fs.readdir(dirs.projects,{withFileTypes:true});const projects=[];
   for(const e of entries){if(!e.isFile()||!e.name.endsWith('.json'))continue;try{const data=JSON.parse(await fs.readFile(path.join(dirs.projects,e.name),'utf8'));if(data&&typeof data.id==='string')projects.push(data);}catch{}}
   return projects.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  },
  saveProject(project){
   return Promise.resolve().then(()=>{const id=validId(project?.id);const snapshot=structuredClone(project);const queued=(queues.get(id)||Promise.resolve()).catch(()=>{}).then(async()=>{snapshot.updatedAt=new Date().toISOString();await atomicWrite(path.join(dirs.projects,`${id}.json`),JSON.stringify(snapshot,null,2));return snapshot;});queues.set(id,queued);return queued;});
  },
  async listAssets(){try{const result=JSON.parse(await fs.readFile(path.join(root,'assets.json'),'utf8'));return Array.isArray(result)?result:[];}catch{return [];}},
  saveAssets(assets){const snapshot=JSON.stringify(assets,null,2);assetsQueue=assetsQueue.catch(()=>{}).then(()=>atomicWrite(path.join(root,'assets.json'),snapshot));return assetsQueue;}
 };
}
module.exports={createStore,atomicWrite,validId};
