const path=require('node:path');

function chooseTextExportContent(content,filePath){
  if(!content||typeof content.markdown!=='string'||typeof content.plain!=='string')throw new Error('Nieprawidłowa treść eksportu.');
  const extension=path.extname(String(filePath)).toLowerCase();
  if(extension==='.md')return content.markdown;
  if(extension==='.txt')return content.plain;
  throw new Error('Eksport tekstu obsługuje tylko format MD lub TXT.');
}

module.exports={chooseTextExportContent};
