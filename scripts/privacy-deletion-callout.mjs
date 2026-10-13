import { readFile } from 'node:fs/promises';
const sections = JSON.parse(await readFile(new URL('../lib/appPrivacySections.json', import.meta.url), 'utf8'));
const copy = {
 de: { title: 'Lotti Baby: Konto und Daten löschen', intro: 'Du kannst die Löschung deines Lotti-Baby-Kontos und der zugehörigen Daten auch ohne installierte App anfordern. Dazu gehören deine Kontodaten, gespeicherten App-Inhalte, Bilder und Sprachnachrichten. Gemeinsam verwaltete Baby-Daten und Inhalte anderer Personen werden vorher geprüft.', action: 'Kontolöschung per E-Mail anfordern', subject: 'Lotti Baby – Konto löschen', details: 'Ablauf, betroffene Daten und Aufbewahrung', body: 'Bitte löscht mein Lotti-Baby-Konto und die zugehörigen personenbezogenen Daten.\n\nE-Mail-Adresse meines Kontos: \n\nBitte bestätigt den Eingang und informiert mich über den Abschluss sowie gegebenenfalls notwendige Aufbewahrungsfristen.' },
 en: { title: 'Lotti Baby: Delete account and data', intro: 'You can request deletion of your Lotti Baby account and associated data without installing the app. This includes your account details, saved app content, images and voice messages. Shared baby data and other people’s content are reviewed first.', action: 'Request account deletion by email', subject: 'Lotti Baby – delete account', details: 'Process, affected data and retention', body: 'Please delete my Lotti Baby account and associated personal data.\n\nAccount email address: \n\nPlease confirm receipt and inform me when deletion is complete, including any necessary retention periods.' },
 es: { title: 'Lotti Baby: Eliminar cuenta y datos', intro: 'Puedes solicitar la eliminación de tu cuenta de Lotti Baby y los datos asociados sin instalar la app. Esto incluye datos de la cuenta, contenido guardado, imágenes y mensajes de voz. Primero se revisan los datos compartidos del bebé y el contenido de otras personas.', action: 'Solicitar la eliminación por correo', subject: 'Lotti Baby – eliminar cuenta', details: 'Proceso, datos afectados y conservación', body: 'Por favor, eliminad mi cuenta de Lotti Baby y los datos personales asociados.\n\nCorreo electrónico de mi cuenta: \n\nConfirmad la recepción e informadme al finalizar, incluidos los plazos de conservación necesarios.' },
};
const escape = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function renderDeletionCallout(locale) {
 const text=copy[locale];
 if (!text) throw new Error('Unsupported locale');
 const paragraphs=sections[locale][7].paragraphs;
 const mailto=`mailto:support@lottibaby.de?subject=${encodeURIComponent(text.subject)}&body=${encodeURIComponent(text.body)}`;
 return `<section id="konto-loeschen" aria-labelledby="konto-loeschen-title" style="scroll-margin-top:24px;margin:0 0 32px;padding:24px;border:2px solid #b8a88a;border-radius:18px;background:#faf8f5;color:#3d332a;line-height:1.7;overflow-wrap:anywhere">
<h2 id="konto-loeschen-title" style="margin:0 0 12px">${escape(text.title)}</h2>
<p>${escape(text.intro)}</p>
<p><a href="${escape(mailto)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#4d3e32;color:#fff;text-decoration:underline;font-weight:600">${escape(text.action)}</a></p>
<p><a href="mailto:support@lottibaby.de">support@lottibaby.de</a></p>
<p>${escape(paragraphs[2])}</p>
<details><summary style="cursor:pointer;font-weight:600;padding:8px 0">${escape(text.details)}</summary>
${[paragraphs[0],paragraphs[3],paragraphs[4]].map(p=>`<p>${escape(p)}</p>`).join('\n')}
</details>
</section>`;
}

export function addDeletionCalloutToPhp(source) {
if(source.includes('ACCOUNT DELETION CALLOUT START'))throw new Error('Already contains the callout; review existing implementation.');
const anchor='$policyHtml = [];';
if(source.split(anchor).length!==2)throw new Error('Unexpected privacy renderer.');
const rendered=Object.fromEntries(['de','en','es'].map(locale=>[locale,renderDeletionCallout(locale)]));
const block='// ACCOUNT DELETION CALLOUT START\n$accountDeletionCallouts = [];\n'+Object.entries(rendered).map(([locale,html])=>`$accountDeletionCallouts['${locale}'] = <<<'DELETION_CALLOUT'\n${html}\nDELETION_CALLOUT;`).join('\n')+'\n// ACCOUNT DELETION CALLOUT END\n\n';
source=source.replace(anchor,block+anchor);
const assign=`$policyHtml[$code] = '<div class="policy-text">'`;
if(source.split(assign).length!==2)throw new Error('Unexpected policy assignment.');
source=source.replace(assign,`$policyHtml[$code] = $accountDeletionCallouts[$code] . '<div class="policy-text">'`);
return source;
}
