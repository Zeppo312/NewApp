/* Reproducible vector layouts with unaltered, embedded Simulator captures.
   NODE_PATH must point to a node_modules directory containing sharp. */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = __dirname;
const W = 1242, H = 2688;
const xml = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const data = name => `data:image/png;base64,${fs.readFileSync(path.join(root,'raw',name+'.png')).toString('base64')}`;
const sources = Object.fromEntries(['day','meals','sleep'].map(k=>[k,data(k)]));
let nextId=0;
const text = (s,x,y,size=48,color='#54415E',weight=400,anchor='start') => `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${xml(s)}</text>`;
function phone(source,x,y,w,rotation=0){
  const h=w*2622/1206, id=`screen${nextId++}`;
  return `<g transform="rotate(${rotation} ${x+w/2} ${y+h/2})">
    <rect x="${x-16}" y="${y-16}" width="${w+32}" height="${h+32}" rx="${w*.105}" fill="#342F37" filter="url(#shadow)"/>
    <rect x="${x-9}" y="${y-9}" width="${w+18}" height="${h+18}" rx="${w*.1}" fill="#151217" stroke="#716B75" stroke-width="3"/>
    <clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w*.09}"/></clipPath>
    <image href="${sources[source]}" x="${x}" y="${y}" width="${w}" height="${h}" clip-path="url(#${id})"/>
  </g>`;
}
function base(color,body){return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.7" y2="1"><stop stop-color="#FFF9F3"/><stop offset="1" stop-color="${color}"/></linearGradient>
<filter id="shadow" x="-40%" y="-30%" width="180%" height="180%"><feDropShadow dx="0" dy="30" stdDeviation="30" flood-color="#332339" flood-opacity=".18"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<circle cx="1190" cy="1460" r="620" fill="#FFFFFF" opacity=".26"/>
<circle cx="-160" cy="2330" r="670" fill="#FFFFFF" opacity=".33"/>
<path d="M -100 1750 Q 470 1260 1400 1740" stroke="#FFFFFF" stroke-width="3" fill="none" opacity=".58"/>
<circle cx="100" cy="125" r="12" fill="#AA8CC1"/>
${text('Lotti Baby',130,140,40,'#675172',600)}
${body}
</svg>`;}
const designs=[
  ['01-flaeschchen',base('#E4D6EF',
    text('Wann war das',90,300,102,'#35283E',700)+
    text('letzte Fläschchen?',90,420,102,'#79519C',700)+
    text('Mahlzeiten und Uhrzeiten im Blick.',94,525,48,'#68596E')+
    phone('meals',161,655,920))],
  ['02-gemeinsam',base('#D7E9E1',
    text('Ihr beide habt',90,300,106,'#35283E',700)+
    text('den Überblick.',90,423,106,'#5A806F',700)+
    text('Baby-Daten gemeinsam nutzen.',94,532,49,'#586B62')+
    `<path d="M 210 740 C 540 520 1070 715 1035 1120" fill="none" stroke="#98B7A7" stroke-width="5" stroke-dasharray="12 16"/>`+
    phone('day',82,805,645,-4)+phone('meals',535,1160,625,4)+
    text('Ein Baby. Euer gemeinsamer Alltag.',621,2607,44,'#4D665A',500,'middle'))],
  ['03-schlaf',base('#D9DCEF',
    text('Schlafzeiten',90,300,109,'#35283E',700)+
    text('einfach festhalten.',90,423,100,'#79519C',700)+
    text('Timer starten. Schlaf im Blick.',94,532,49,'#68596E')+
    phone('sleep',161,655,920))]
];
(async()=>{
 for(const [name,svg] of designs){
   fs.writeFileSync(path.join(root,name+'.svg'),svg);
   await sharp(Buffer.from(svg)).flatten({background:'#FFF9F3'}).toColourspace('srgb').png().toFile(path.join(root,name+'.png'));
 }
 const thumbW=414, thumbH=896, gap=24;
 const thumbs=await Promise.all(designs.map(async([name],i)=>({input:await sharp(path.join(root,name+'.png')).resize(thumbW,thumbH).toBuffer(),left:24+i*(thumbW+gap),top:24})));
 await sharp({create:{width:3*thumbW+4*gap,height:thumbH+48,channels:3,background:'#F0EDEA'}}).composite(thumbs).png().toFile(path.join(root,'vorschau.png'));
 const result=[];
 for(const [name] of designs){const m=await sharp(path.join(root,name+'.png')).metadata();if(m.width!==W||m.height!==H||m.hasAlpha)throw Error('Invalid export '+name);result.push({file:name+'.png',width:m.width,height:m.height,space:m.space,alpha:m.hasAlpha});}
 fs.writeFileSync(path.join(root,'export-pruefung.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
})();
