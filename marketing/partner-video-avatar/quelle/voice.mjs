import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const segments=[
{scene:'home',text:'Hey, die Kleine ist gerade eingeschlafen.',lines:['Hey, die Kleine ist','gerade eingeschlafen.']},
{scene:'sleep',text:'Ich starte kurz den Schlaftracker.',lines:['Ich starte kurz','den Schlaftracker.']},
{scene:'sleep',text:'So halten wir fest, wann ihr Schläfchen angefangen hat.',lines:['So halten wir fest, wann ihr','Schläfchen angefangen hat.']},
{scene:'day',text:'Und dass ich sie gerade gewickelt habe, trage ich noch in Unser Tag ein.',lines:['Und dass ich sie gerade gewickelt habe,','trage ich noch in „Unser Tag“ ein.']},
{scene:'home',text:'Wenn du gleich übernimmst, kannst du einfach nachschauen.',lines:['Wenn du gleich übernimmst,','kannst du einfach nachschauen.']},
{scene:'end',text:'Lotti Baby. Ein Baby. Ein Team.',lines:['LottiBaby.','Ein Baby. Ein Team.']}
];
let cursor=0;const concat=[];
for(let i=0;i<segments.length;i++){
 const a=path.join(root,'audio',`${i}.aiff`),w=path.join(root,'audio',`${i}.wav`);
 let r=spawnSync('/usr/bin/say',['-v','Anna','-r','145','-o',a,segments[i].text]);if(r.status)throw Error(r.stderr.toString());
 r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',a,'-af','apad=pad_dur=0.65','-ar','48000','-ac','1',w]);if(r.status)throw Error(r.stderr.toString());
 const d=Number(spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',w]).stdout.toString());
 segments[i].start=cursor;segments[i].duration=d;cursor+=d;concat.push(`file '${i}.wav'`);
}
fs.writeFileSync(path.join(root,'audio','concat.txt'),concat.join('\n'));
spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',path.join(root,'audio','concat.txt'),'-c','copy',path.join(root,'audio','sprecherin.wav')]);
fs.writeFileSync(path.join(root,'quelle','timeline.json'),JSON.stringify({duration:cursor,segments},null,2));
const stamp=n=>{let ms=Math.round(n*1000);const h=Math.floor(ms/3600000);ms%=3600000;const m=Math.floor(ms/60000);ms%=60000;const s=Math.floor(ms/1000);return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`};
fs.writeFileSync(path.join(root,'exports','untertitel.srt'),segments.map((s,i)=>`${i+1}\n${stamp(s.start)} --> ${stamp(s.start+s.duration-.1)}\n${s.lines.join('\n')}\n`).join('\n'));
console.log(JSON.stringify({duration:cursor,segments}));
