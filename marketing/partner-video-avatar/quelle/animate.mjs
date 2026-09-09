import fs from 'node:fs';import path from 'node:path';import {spawn,spawnSync} from 'node:child_process';import {once} from 'node:events';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);let sharp;try{sharp=require('sharp')}catch{sharp=require('../../partner-kampagne-2026-09-07/quelle/node_modules/sharp')}
const timeline=JSON.parse(fs.readFileSync(path.join(root,'quelle','timeline.json')));
const pcm=spawnSync('ffmpeg',['-v','error','-i',path.join(root,'audio','sprecherin.wav'),'-f','f32le','-ar','8000','-ac','1','pipe:1'],{maxBuffer:10e6}).stdout;
const samples=new Float32Array(pcm.buffer,pcm.byteOffset,pcm.byteLength/4);
const fps=25,frames=Math.ceil(timeline.duration*fps),purple='#8E4EC6',ink='#5C4033',cream='#FFF8F0';
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const tx=(x,y,s,size=28,fill=ink,attrs='')=>`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" fill="${fill}" ${attrs}>${esc(s)}</text>`;
const rect=(x,y,w,h,r,fill,attrs='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${attrs}/>`;
const line=(x1,y1,x2,y2,c,w)=>`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
function voice(t){let sum=0,start=Math.floor(t*8000),n=320;for(let i=start;i<Math.min(samples.length,start+n);i++)sum+=samples[i]*samples[i];return Math.min(1,Math.sqrt(sum/n)*12);}
function person(x,y,scale,t,gender='woman',talk=false,phone=false){
const woman=gender==='woman',skin=woman?'#D79C79':'#C58A63',shirt=woman?'#B89ACA':'#A4B4A0',hair=woman?'#684232':'#4C352C';
const a=talk?voice(t):0,nod=talk?Math.sin(t*3.2)*2:Math.sin(t*1.3)*1.2,blink=t%3.6>3.43,eyes=woman?4:-4;
return `<g transform="translate(${x} ${y}) scale(${scale})">`+
// legs and seated torso
line(-38,290,-72,412,'#8F7970',56)+line(45,291,77,412,'#8F7970',56)+rect(-109,401,73,26,13,'#6A5147')+rect(49,401,73,26,13,'#6A5147')+
`<path d="M-60 133Q0 109 60 133L87 295Q0 327 -87 295Z" fill="${shirt}"/>`+
line(-52,151,-83,235,shirt,42)+line(-83,235,-42,271,skin,25)+
`<g transform="rotate(${phone?Math.sin(t*1.5)*3:-3} 49 166)">`+line(51,157,90,220,shirt,42)+line(90,220,69,246,skin,26)+(phone?`<g transform="translate(50 184) rotate(-12)">${rect(0,0,47,83,9,'#30263E')}${rect(5,7,37,65,5,'#DCC4EC')}${line(10,39,30,39,purple,3)}${line(10,48,25,48,purple,3)}</g>`:'')+`</g>`+
rect(-20,95,40,42,12,skin)+`<g transform="rotate(${nod} 0 95)">`+
(woman?`<ellipse cx="-4" cy="32" rx="66" ry="86" fill="${hair}"/><circle cx="-32" cy="-38" r="30" fill="${hair}"/>`:`<ellipse cx="0" cy="28" rx="60" ry="61" fill="${hair}"/>`)+
`<ellipse cx="0" cy="52" rx="51" ry="62" fill="${skin}"/>`+
(woman?`<path d="M-55 25Q-57 -32 15 -23Q66 -9 54 33Q19 18 9 -4Q-10 26 -55 25" fill="${hair}"/>`:`<path d="M-53 23Q-65 -31 3 -25Q62 -35 55 27L42 11Q4 18 -18 -2Q-35 18 -53 23" fill="${hair}"/>`)+
(blink?line(-30,46,-16,46,hair,3)+line(16,46,30,46,hair,3):`<ellipse cx="-23" cy="46" rx="8" ry="6" fill="#FFF8F0"/><ellipse cx="23" cy="46" rx="8" ry="6" fill="#FFF8F0"/><circle cx="${-23+eyes}" cy="47" r="3.6" fill="${hair}"/><circle cx="${23+eyes}" cy="47" r="3.6" fill="${hair}"/>`)+
`<path d="M2 53L-1 66L6 67" fill="none" stroke="#B77757" stroke-width="3" stroke-linecap="round"/>`+
(a>.08?`<ellipse cx="4" cy="84" rx="${7+a*6}" ry="${2+a*9}" fill="#743F39"/><path d="M-4 80L12 80" stroke="#FFF2DF" stroke-width="3"/>`:`<path d="M-9 81Q3 91 16 80" fill="none" stroke="#743F39" stroke-width="3" stroke-linecap="round"/>`)+
(!woman?`<path d="M-40 70Q-37 116 0 115Q42 114 43 71Q33 96 20 96Q1 106 -20 94Z" fill="${hair}" opacity=".65"/>`:'')+`</g></g>`;
}
function room(t){return `<path d="M0 905Q350 883 720 906V1090H0Z" fill="#E9DBCC"/>`+rect(455,330,170,240,85,'#DCCBE8')+`<path d="M540 340V554M468 450H611" stroke="#FFF8F0" stroke-width="9"/>`+`<circle cx="582" cy="388" r="19" fill="#FFF8F0"/>`+rect(72,644,576,255,55,'#D8C6B9')+rect(57,745,94,166,38,'#CDB6A5')+rect(579,745,94,166,38,'#CDB6A5')+rect(134,800,452,103,25,'#E1D1C5')+line(155,897,147,954,'#937765',16)+line(574,897,582,954,'#937765',16)+`<ellipse cx="353" cy="1002" rx="291" ry="34" fill="#DACABD"/>`+line(75,617,75,391,'#82947A',5)+`<ellipse cx="56" cy="464" rx="20" ry="43" fill="#9CAD90" transform="rotate(-35 56 464)"/><ellipse cx="93" cy="430" rx="20" ry="43" fill="#A6B69A" transform="rotate(34 93 430)"/>`+rect(45,565,61,65,9,'#BF9D82');}
function pointer(x,y,t,start){const u=t-start;if(u<0||u>1.1)return '';return `<circle cx="${x}" cy="${y}" r="${12+u*35}" fill="none" stroke="#CFB0E7" stroke-width="5" opacity="${1-u/1.1}"/><circle cx="${x}" cy="${y}" r="11" fill="#E8BD9F"/>`;}
function device(scene,local,t){let content='';const running=local>1.35;
if(scene==='sleep'){
content=tx(397,451,'Schlaftracker',31,cream,'text-anchor="middle" font-weight="700"')+`<path d="M405 504A36 36 0 1 0 437 552A31 31 0 0 1 405 504" fill="#CDB0E1"/>`+tx(397,641,running?'Schlaf läuft':'Bereit fürs Schläfchen',running?29:23,ink,'text-anchor="middle"')+tx(397,716,running?`00:00:0${Math.min(9,Math.floor(local-1.35))}`:'00:00:00',50,purple,'text-anchor="middle" font-weight="700"')+rect(262,773,270,69,34,running?'#EBDFF2':purple)+tx(397,816,running?'Schlaf beenden':'Schlaf starten',24,running?purple:'#FFFFFF','text-anchor="middle"')+pointer(421,807,local,.8)+(running?tx(397,925,'Startzeit festgehalten',22,ink,'text-anchor="middle"'):'');
}else{const editing=local>1.15,saved=local>3.35;
content=tx(397,451,'Unser Tag',31,cream,'text-anchor="middle" font-weight="700"')+tx(268,535,'Heute',26,ink,'font-weight="700"')+
(saved?rect(252,578,291,225,22,'#F2ECF6')+`<circle cx="294" cy="624" r="20" fill="#A4B4A0"/><path d="M284 624L292 632L305 616" fill="none" stroke="white" stroke-width="4"/>`+tx(327,633,'Gewickelt',25,ink,'font-weight="700"')+tx(273,693,'Gerade eben',23)+tx(273,737,'Eintrag gespeichert',21,purple):editing?rect(251,574,293,270,22,'#F2ECF6')+tx(271,623,'Wickeln eintragen',25,ink,'font-weight="700"')+tx(271,681,'Zeit: Jetzt',23)+rect(271,726,250,65,32,purple)+tx(397,768,'Speichern',24,'#FFFFFF','text-anchor="middle"'):rect(255,584,286,78,39,purple)+tx(397,634,'+ Wickeln',25,'#FFFFFF','text-anchor="middle"'))+pointer(421,624,local,.65)+pointer(421,755,local,2.8);
}
return `<g transform="translate(0 ${Math.sin(t*1.3)*2})">`+rect(219,356,356,645,42,'#30263E')+rect(235,377,324,604,29,'#FFFFFF')+`<path d="M264 377H530Q559 377 559 406V482H235V406Q235 377 264 377" fill="#493655"/>`+rect(346,388,102,15,8,'#261C30')+content+rect(349,956,97,5,2,'#CBBECD')+`</g>`;
}
function frame(t){const seg=timeline.segments.find(s=>t>=s.start&&t<s.start+s.duration)||timeline.segments.at(-1);const local=t-seg.start;let body='';const scene=seg.scene;
if(scene==='home')body=room(t)+person(245,518,.91,t,'woman',true,true)+person(495,526,.90,t,'man',false,false);
if(scene==='sleep'||scene==='day'){
const start=timeline.segments.find(s=>s.scene===scene).start;
body=`<circle cx="380" cy="693" r="312" fill="#EFE3F6"/>`+person(110,789,.48,t,'woman',true,true)+device(scene,t-start,t)+tx(397,1043,'ANIMIERTE DEMO · KEINE LIVE-AUFNAHME',14,'#7D5A50','text-anchor="middle" letter-spacing=".5"');
}
if(scene==='end')body=`<circle cx="360" cy="652" r="258" fill="#EFE3F6"/>`+person(240,513,.77,t,'woman',false,true)+person(481,520,.77,t,'man',false,false)+tx(360,381,'Ein Baby.',62,ink,'text-anchor="middle" style="font-family:Georgia"')+tx(360,459,'Ein Team.',62,ink,'text-anchor="middle" style="font-family:Georgia"')+rect(158,959,404,70,35,purple)+tx(360,1004,'LottiBaby entdecken',27,'#FFFFFF','text-anchor="middle" font-weight="700"');
const title=scene==='sleep'?'Ein Schläfchen festhalten.':scene==='day'?'Die kleinen Dinge teilen.':scene==='end'?'Gemeinsam im Blick.':'Für euren Alltag als Team.';
return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">${rect(0,0,720,1280,0,cream)}${tx(48,119,'LottiBaby',30,ink,'font-weight="700"')}${tx(672,117,'2D · ENTWURF',14,'#7D5A50','text-anchor="end" letter-spacing="1"')}${tx(48,207,title,35,ink,'font-weight="700"')}${body}${rect(35,1090,650,130,24,'#30263E')}${seg.lines.map((s,i)=>tx(360,1140+i*38,s,27,'#FFFFFF','text-anchor="middle"')).join('')}<rect x="48" y="1251" width="${624*Math.min(1,t/timeline.duration)}" height="4" rx="2" fill="${purple}"/></svg>`;
}
const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','png','-framerate',String(fps),'-i','pipe:0','-i',path.join(root,'audio','sprecherin.wav'),'-vf','scale=1080:1920:flags=lanczos,format=yuv420p','-c:v','libx264','-preset','fast','-crf','20','-threads','2','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',path.join(root,'exports','LottiBaby-Partner-2D-Entwurf.mp4')],{stdio:['pipe','inherit','inherit']});
let failed;ff.on('error',e=>failed=e);ff.stdin.on('error',e=>failed=e);
for(let n=0;n<frames;n++){
 const svg=frame(n/fps);const png=await sharp(Buffer.from(svg)).png().toBuffer();
 if(n%125===0){console.log(`Frame ${n}/${frames}`);fs.writeFileSync(path.join(root,'quelle',`pruefung-${n}.png`),png);}
 if(n===40){await sharp(Buffer.from(svg)).resize(1080,1920).png().toFile(path.join(root,'exports','Vorschaubild.png'));fs.writeFileSync(path.join(root,'quelle','szene.svg'),svg);}
 if(failed)throw failed;if(!ff.stdin.write(png))await once(ff.stdin,'drain');
}
ff.stdin.end();const [code]=await once(ff,'close');if(code)throw Error(`FFmpeg ${code}`);console.log('Animation exported.');
