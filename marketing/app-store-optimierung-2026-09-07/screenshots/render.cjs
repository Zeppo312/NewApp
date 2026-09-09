const fs = require('fs');
const path = require('path');
const {pathToFileURL} = require('url');
const runtime = process.env.CODEX_NODE_MODULES || '/Users/janzeppenfeld/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = require(path.join(runtime,'playwright'));
const root=path.resolve(__dirname,'../../..');
const scenes=[
 ['01-babyalltag','unser-tag-voll.png','Wann war das letzte<br>Fläschchen?','Stillen, Flasche und Windeln<br>auf einen Blick.'],
 ['02-gemeinsam','partner-voll.png','Ein Baby. Euer<br>gemeinsamer Überblick.','Verknüpft eure Accounts und<br>teilt die Baby-Daten.'],
 ['03-schlaf','schlaf-voll.png','Schlaf festhalten.<br>Verlauf im Blick.','Schlafphasen einfach<br>starten und beenden.'],
 ['04-kliniktasche','17.png','Bereit für euren<br>großen Tag.','Die Klinik-Checkliste:<br>abhaken, ergänzen, vorbereitet sein.',true],
 ['05-erste-zaehne','23.png','Ein erster Zahn.<br>Eine neue Erinnerung.','Halte fest, welche Milchzähne<br>schon da sind.',true],
 ['06-tagesplanung','15.png','Euer Alltag.<br>Gemeinsam geplant.','Aufgaben und Termine<br>in einer Tagesübersicht.',true],
 ['07-babywetter','22.png','Was ziehen wir<br>heute an?','Kleidungsideen für Kinderwagen,<br>Babytrage und mehr.',true]
];
(async()=>{
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1242,height:2688},deviceScaleFactor:1});
for(const [name,source,headline,sub,legacy] of scenes){
 if(process.argv.includes('--new') && !legacy) continue;
 const img='data:image/png;base64,'+fs.readFileSync(path.join(root,legacy?'store/apple/screenshot/de-DE/APP_IPHONE_65':'marketing/lottibaby-produktspot/assets',source)).toString('base64');
 const html=`<!doctype html><html lang="de"><meta charset="utf-8"><title>Lotti Baby – ${name}</title><style>
*{box-sizing:border-box}html,body{margin:0;width:1242px;height:2688px;overflow:hidden}body{color:#644334;background:radial-gradient(ellipse at 95% 65%,#eadef1 0,transparent 52%),radial-gradient(ellipse at 0% 5%,#fffdf8 0,transparent 50%),#faf3ec;font-family:Arial,sans-serif}.brand{position:absolute;top:60px;width:100%;text-align:center;font-size:40px;font-weight:600;letter-spacing:1px}h1{position:absolute;top:133px;left:44px;right:44px;margin:0;text-align:center;font-family:Didot,Georgia,serif;font-weight:400;font-size:94px;line-height:1.1;letter-spacing:-2px}p{position:absolute;top:362px;left:70px;right:70px;margin:0;text-align:center;font-size:41px;line-height:1.35;color:#826456}.phone{position:absolute;left:157px;top:557px;width:928px;padding:12px;border:5px solid #6c6966;border-radius:112px;background:#171717;box-shadow:0 22px 60px #63413425,0 0 0 3px #b8b5b0}.phone img{display:block;width:894px;height:auto;border-radius:94px}
${legacy?`.detail{position:relative;width:894px;height:1758px;overflow:hidden;border-radius:94px}.phone .detail img{position:absolute;width:1173.7548px;max-width:none;height:auto;left:-139.865px;top:-472.516px;border-radius:0}.caption{position:absolute;top:2440px;left:80px;right:80px;text-align:center;font-size:31px;letter-spacing:2px;color:#826456}`:''}
</style><div class="brand">Lotti Baby</div><h1>${headline}</h1><p>${sub}</p><div class="phone">${legacy?'<div class="detail">':''}<img src="${img}" alt="Originalaufnahme der App">${legacy?'</div>':''}</div>${legacy?'<div class="caption">LOTTI BABY · EIN BLICK IN DIE APP</div>':''}</html>`;
 const hp=path.join(__dirname,name+'.html');fs.writeFileSync(hp,html);
 await page.goto(pathToFileURL(hp).href);await page.evaluate(()=>document.fonts.ready);
 await page.locator('img').evaluate(img=>img.decode());
 const checks=await page.evaluate(()=>{const p=document.querySelector('.phone').getBoundingClientRect();return {phoneBottom:p.bottom,height:innerHeight,loaded:document.querySelector('img').naturalWidth}});
 if(checks.phoneBottom>2688||checks.loaded!==(legacy?1242:1206))throw new Error(JSON.stringify(checks));
 await page.screenshot({path:path.join(__dirname,name+'.png')});console.log(name,checks);
}
await browser.close();
})();
