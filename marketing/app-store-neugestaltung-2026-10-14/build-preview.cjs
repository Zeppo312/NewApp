const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=require('sharp');
const root=__dirname;
const repo=path.resolve(root,'../..');
const target=process.argv[2];
if(!target||!path.isAbsolute(target))throw Error('Pass an absolute output path.');
const sources={
  ICON:['assets/images/icon.png',120],
  OLD1:['store/apple/screenshot/de-DE/APP_IPHONE_65/14.png',420],
  OLD2:['store/apple/screenshot/de-DE/APP_IPHONE_65/20.png',420],
  OLD3:['store/apple/screenshot/de-DE/APP_IPHONE_65/19.png',420],
  MEALS:['marketing/app-store-neugestaltung-2026-10-14/serie/export/de-DE/APP_IPHONE_67/01-mahlzeiten.png',420],
  DAY:['marketing/app-store-neugestaltung-2026-10-14/serie/export/de-DE/APP_IPHONE_67/02-gemeinsam.png',420],
  SLEEP:['marketing/app-store-neugestaltung-2026-10-14/serie/export/de-DE/APP_IPHONE_67/03-schlaf.png',420]
};
(async()=>{
  let html=fs.readFileSync(path.join(root,'preview.fragment.html'),'utf8');
  const manifest=[];
  for(const [key,[relative,width]] of Object.entries(sources)){
    const original=fs.readFileSync(path.join(repo,relative));
    const preview=await sharp(original).resize({width,withoutEnlargement:true}).jpeg({quality:83}).toBuffer();
    html=html.replaceAll('@@'+key+'@@','data:image/jpeg;base64,'+preview.toString('base64'));
    manifest.push({source:relative,sourceSha256:crypto.createHash('sha256').update(original).digest('hex'),previewWidth:width});
  }
  if(/@@[A-Z0-9]+@@/.test(html))throw Error('Unresolved image placeholder.');
  const bytes=Buffer.byteLength(html);if(bytes>=1000000)throw Error('Preview exceeds inline size limit.');
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,html);
  fs.writeFileSync(path.join(root,'preview-sources.json'),JSON.stringify({images:manifest,method:'Proportional display resizing only; original UI, text and values unchanged.'},null,2)+'\n');
  console.log(JSON.stringify({path:target,bytes,sourceImages:manifest.length}));
})();
