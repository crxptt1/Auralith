const fs=require('node:fs/promises');
const path=require('node:path');
const same=(a,b)=>process.platform==='win32'?path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase():path.resolve(a)===path.resolve(b);

async function removePreviousPreviews({renders,keepPath}){
 const root=path.resolve(renders);const keep=path.resolve(keepPath);
 if(path.dirname(keep)!==root)throw new Error('Preview path is outside application renders.');
 const names=await fs.readdir(root,{withFileTypes:true}).catch(error=>error.code==='ENOENT'?[]:Promise.reject(error));
 await Promise.all(names.filter(entry=>entry.isFile()&&/_preview_[^.]+\.(wav|mp3|flac)$/i.test(entry.name)).map(async entry=>{
  const candidate=path.join(root,entry.name);
  if(same(candidate,keep))return;
  const stat=await fs.lstat(candidate);if(!stat.isFile()||stat.isSymbolicLink())return;
  await fs.rm(candidate,{force:true});
 }));
}
module.exports={removePreviousPreviews};
