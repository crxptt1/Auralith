const fs=require('node:fs');
const ts=require('typescript');
fs.mkdirSync('desktop',{recursive:true});
for(const name of ['model','i18n','translations']){
 const result=ts.transpileModule(fs.readFileSync(`src/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
 fs.writeFileSync(`desktop/${name}.mjs`,result.outputText.replace(/(from\s+['"]\.\/[^'"]+)\.js(['"])/g,'$1.mjs$2'));
}
