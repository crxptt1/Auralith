const fs=require('node:fs/promises');
const path=require('node:path');
const same=(a,b)=>process.platform==='win32'?path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase():path.resolve(a)===path.resolve(b);
async function trashRenderedExport({renders,project,exportId,projects,trashItem}){
 const result=project.exports.find(item=>item.id===exportId);
 if(!result)throw new Error('Export not found.');
 const file=path.resolve(result.path);
 if(!same(path.dirname(file),renders)||!/^\.(wav|mp3|flac)$/i.test(path.extname(file)))throw new Error('Only application-owned render files can be recycled.');
 for(const p of projects){
  if((p.layers||[]).some(l=>same(l.path,file))||(p.background?.kind==='file'&&same(p.background.path,file))||(p.exports||[]).some(r=>same(r.path,file)&&!(p.id===project.id&&r.id===exportId)))throw new Error('This audio is used by another project or export. Remove only the history entry.');
 }
 const existing=[];
 for(const candidate of [file,file+'.json']){
  try{const stat=await fs.lstat(candidate);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Only application-owned regular files can be recycled.');const real=await fs.realpath(candidate),root=await fs.realpath(renders);if(!same(path.dirname(real),root))throw new Error('File is outside application renders.');existing.push(candidate);}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 // Move the audio first. If its optional report fails, the export is still removed
 // successfully; retaining a report must not resurrect an unavailable audio entry.
 if(existing.includes(file))await trashItem(file);
 let reportRetained=false;
 if(existing.includes(file+'.json'))try{await trashItem(file+'.json');}catch{reportRetained=true;}
 return {reportRetained};
}
module.exports={trashRenderedExport};
