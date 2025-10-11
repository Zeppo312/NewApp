import { Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getGeburtsplan } from './supabase';
import { formatContentForHTMLLeftColumn, formatContentForHTMLRightColumn } from '@/components/geburtsplan/formatHelpers';

// Helper: escape HTML
const escapeHtml = (str: string) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Helper: checkbox option row
const renderOption = (label: string, checked: boolean) =>
  `<div class="option"><span class="box">${checked ? '☑' : '☐'}</span><span class="opt-label">${escapeHtml(label)}</span></div>`;

const renderOptions = (all: string[], selected: string[] = []) =>
  `<div class="options">${all.map((o) => renderOption(o, selected.includes(o))).join('')}</div>`;

// Erstelle ein schönes, strukturiertes HTML direkt aus structured_data
const buildHtmlFromStructuredData = (
  data: any,
  babyIconBase64?: string | null
) => {
  const colorBg = '#FFF8F0';
  const colorCard = '#FFFFFF';
  const colorBorder = '#E8D5C4';
  const colorTitle = '#7D5A50';
  const colorAccent = '#8E4EC6';
  const colorText = '#4A3D37';

  const metaRows: Array<{ label: string; value: string }> = [
    { label: 'Name der Mutter', value: data?.allgemeineAngaben?.mutterName || '' },
    { label: 'Entbindungstermin (ET)', value: data?.allgemeineAngaben?.entbindungstermin || '' },
    { label: 'Geburtsklinik / Hausgeburt', value: data?.allgemeineAngaben?.geburtsklinik || '' },
    { label: 'Begleitperson(en)', value: data?.allgemeineAngaben?.begleitpersonen || '' },
  ];

  const section = (title: string, bodyHtml: string) => `
    <section class="section">
      <div class="section-header">
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="card">
        ${bodyHtml}
      </div>
    </section>
  `;

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Mein Geburtsplan</title>
      <style>
        @page { size: A4; margin: 1.5cm; }
        :root {
          --bg: ${colorBg};
          --card: ${colorCard};
          --border: ${colorBorder};
          --title: ${colorTitle};
          --accent: ${colorAccent};
          --text: ${colorText};
        }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); font-size: 10pt; }
        .container { width: 100%; margin: 0 auto; }
        .header { text-align: center; padding: 8px 12px 10px; margin-bottom: 10px; border-bottom: 1px solid var(--border); position: relative; }
        .brand { position: absolute; left: 12px; top: 8px; display: inline-flex; align-items: center; gap: 8px; color: var(--accent); font-weight: 800; }
        .brand .dot { width: 8px; height: 8px; background: var(--accent); border-radius: 999px; display: inline-block; }
        .title { font-size: 20pt; color: var(--title); margin: 0; }
        .subtitle { margin: 2px 0 0; color: #8b756d; font-size: 10pt; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; margin-top: 12px; }
        .meta .row { display: grid; grid-template-columns: 1.2fr 1fr; gap: 8px; align-items: baseline; }
        .meta .label { color: var(--title); font-weight: 700; }
        .meta .value { color: var(--text); }
        .section { page-break-inside: avoid; margin: 14px 0; }
        .section-header h2 { margin: 0 0 8px; font-size: 13pt; color: var(--title); border-bottom: 2px solid var(--border); padding-bottom: 4px; }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; }
        .group { margin-bottom: 10px; }
        .group h3 { margin: 0 0 6px; font-size: 11pt; color: var(--title); }
        .options { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
        .option { display: flex; align-items: center; gap: 8px; }
        .box { font-size: 11pt; line-height: 1; }
        .opt-label { font-size: 10pt; }
        .list { margin: 0; padding-left: 14px; }
        .list li { margin: 3px 0; }
        .muted { color: #8b756d; font-style: italic; }
        .kv { display: grid; grid-template-columns: 1.2fr 1fr; gap: 6px 10px; }
        .kv .k { color: var(--title); font-weight: 600; }
        .kv .v { color: var(--text); }
        .footer { text-align: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border); color: #8b756d; font-size: 9pt; }
        .baby-icon { margin: 8px 0 4px; }
        .baby-icon img { height: 46px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="brand"><span class="dot"></span><span>LottiBaby · Wehen‑Tracker</span></div>
          <h1 class="title">Mein Geburtsplan</h1>
          <div class="subtitle">Erstellt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
          ${babyIconBase64 ? `<div class="baby-icon"><img src="data:image/png;base64,${babyIconBase64}" alt="Baby"/></div>` : ''}
        </div>

        <section class="section">
          <div class="section-header"><h2>1. Allgemeine Angaben</h2></div>
          <div class="card">
            <div class="kv">
              ${metaRows.map(r => `<div class="k">${escapeHtml(r.label)}</div><div class="v">${r.value && String(r.value).trim() ? escapeHtml(r.value) : '–'}</div>`).join('')}
            </div>
          </div>
        </section>

        ${(() => {
          const gp = data?.geburtsWuensche || {};
          const posOpts = ['Stehend', 'Hocken', 'Vierfüßler', 'im Wasser', 'flexibel'];
          const painOpts = ['Ohne Schmerzmittel', 'PDA', 'TENS', 'Lachgas', 'offen für alles'];
          const rolleOpts = ['Aktiv unterstützen', 'eher passiv', 'jederzeit ansprechbar'];
          const atmosOpts = ['Eigene Musik', 'ruhige Umgebung', 'gedimmtes Licht'];
          return section('2. Wünsche zur Geburt', `
            <div class="group"><h3>Geburtspositionen</h3>${renderOptions(posOpts, gp.geburtspositionen || [])}</div>
            <div class="group"><h3>Schmerzmittel</h3>${renderOptions(painOpts, gp.schmerzmittel || [])}</div>
            <div class="group"><h3>Rolle der Begleitperson</h3>${renderOptions(rolleOpts, gp.rolleBegleitperson ? [gp.rolleBegleitperson] : [])}</div>
            <div class="group"><h3>Musik / Atmosphäre</h3>${renderOptions(atmosOpts, gp.musikAtmosphaere || [])}</div>
            <div class="group"><h3>Sonstige Wünsche</h3><div>${gp.sonstigeWuensche ? escapeHtml(gp.sonstigeWuensche) : '<span class="muted">–</span>'}</div></div>
          `);
        })()}

        ${(() => {
          const mi = data?.medizinischeEingriffe || {};
          const wehenOpts = ['Nur wenn medizinisch nötig', 'keine künstliche Einleitung', 'Offen für medizinische Empfehlungen'];
          const dammOpts = ['Möglichst vermeiden', 'akzeptabel wenn notwendig', 'Nach ärztlicher Empfehlung'];
          const monOpts = ['Mobil bleiben, CTG nur zeitweise', 'Dauer-CTG ok', 'Nach medizinischer Notwendigkeit'];
          const notOpts = ['Nur als letzte Option', 'offen dafür', 'Nach medizinischer Notwendigkeit'];
          return section('3. Medizinische Eingriffe & Maßnahmen', `
            <div class="group"><h3>Wehenförderung</h3>${renderOptions(wehenOpts, mi.wehenfoerderung ? [mi.wehenfoerderung] : [])}</div>
            <div class="group"><h3>Dammschnitt / -massage</h3>${renderOptions(dammOpts, mi.dammschnitt ? [mi.dammschnitt] : [])}</div>
            <div class="group"><h3>Monitoring</h3>${renderOptions(monOpts, mi.monitoring ? [mi.monitoring] : [])}</div>
            <div class="group"><h3>Notkaiserschnitt</h3>${renderOptions(notOpts, mi.notkaiserschnitt ? [mi.notkaiserschnitt] : [])}</div>
            <div class="group"><h3>Sonstige Eingriffe</h3><div>${mi.sonstigeEingriffe ? escapeHtml(mi.sonstigeEingriffe) : '<span class="muted">–</span>'}</div></div>
          `);
        })()}

        ${(() => {
          const ndg = data?.nachDerGeburt || {};
          const boolRow = (title: string, val: boolean) => renderOptions(['Ja', 'Nein'], [val ? 'Ja' : 'Nein']);
          const plazentaOpts = ['Natürlich gebären', 'keine Routine-Injektion', 'Nach medizinischer Empfehlung'];
          const vitKOpts = ['Ja', 'Nein', 'Besprechen'];
          return section('4. Nach der Geburt', `
            <div class="group"><h3>Bonding</h3>${boolRow('Bonding', !!ndg.bonding)}</div>
            <div class="group"><h3>Stillen</h3>${boolRow('Stillen', !!ndg.stillen)}</div>
            <div class="group"><h3>Plazenta</h3>${renderOptions(plazentaOpts, ndg.plazenta ? [ndg.plazenta] : [])}</div>
            <div class="group"><h3>Vitamin-K-Gabe fürs Baby</h3>${renderOptions(vitKOpts, ndg.vitaminKGabe ? [ndg.vitaminKGabe] : [])}</div>
            <div class="group"><h3>Sonstige Wünsche</h3><div>${ndg.sonstigeWuensche ? escapeHtml(ndg.sonstigeWuensche) : '<span class="muted">–</span>'}</div></div>
          `);
        })()}

        ${(() => {
          const nf = data?.notfall || {};
          const beglOpts = ['Ja', 'Nein', 'wenn möglich'];
          const fotoOpts = ['Ja', 'Nein', 'nur nach Absprache'];
          const boolRow = (val: boolean) => renderOptions(['Ja', 'Nein'], [val ? 'Ja' : 'Nein']);
          return section('5. Für den Notfall / Kaiserschnitt', `
            <div class="group"><h3>Begleitperson im OP</h3>${renderOptions(beglOpts, nf.begleitpersonImOP ? [nf.begleitpersonImOP] : [])}</div>
            <div class="group"><h3>Bonding im OP</h3>${boolRow(!!nf.bondingImOP)}</div>
            <div class="group"><h3>Fotoerlaubnis</h3>${renderOptions(fotoOpts, nf.fotoerlaubnis ? [nf.fotoerlaubnis] : [])}</div>
            <div class="group"><h3>Sonstige Wünsche</h3><div>${nf.sonstigeWuensche ? escapeHtml(nf.sonstigeWuensche) : '<span class="muted">–</span>'}</div></div>
          `);
        })()}

        ${section('6. Sonstige Wünsche / Hinweise', `
          <div>${data?.sonstigeWuensche?.freitext ? escapeHtml(data.sonstigeWuensche.freitext) : '<span class="muted">–</span>'}</div>
        `)}

        <div class="footer">
          <div><strong>LottiBaby · Wehen‑Tracker</strong> — Liebe. Klarheit. Überblick.</div>
          <div>Dieser Geburtsplan wurde mit der LottiBaby App erstellt.</div>
        </div>
      </div>
    </body>
  </html>`;

  return html;
};

// Funktion zum Generieren und Herunterladen des Geburtsplans als PDF
export const generateAndDownloadPDF = async (babyIconBase64: string | null, setIsGeneratingPDF?: (value: boolean) => void) => {
  try {
    if (setIsGeneratingPDF) {
      setIsGeneratingPDF(true);
    }

    // Geburtsplan laden
    const { data, error } = await getGeburtsplan();

    if (error) {
      console.error('Error loading geburtsplan:', error);
      Alert.alert('Fehler', 'Der Geburtsplan konnte nicht geladen werden.');
      return;
    }

    if (!data) {
      Alert.alert('Hinweis', 'Es wurde noch kein Geburtsplan erstellt.');
      return;
    }

    // Erstelle HTML für das PDF
    let htmlContent: string;
    if (data.structured_data) {
      htmlContent = buildHtmlFromStructuredData(data.structured_data, babyIconBase64);
    } else {
      // Fallback: bestehendes 2-Spalten-Layout aus Textinhalt
      const content = data.textContent || data.content || '';
      htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mein Geburtsplan</title>
      <style>@page{margin:1.5cm;size:A4;}body{font-family:Arial,Helvetica,sans-serif;line-height:1.5;margin:0;color:#333;background:#FFF8F0;font-size:10pt}.container{max-width:100%;margin:0 auto;background:#fff;padding:20px}.header{text-align:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #E8D5C4}h1{color:#7D5A50;font-size:18pt;margin:0 0 5px}h2{color:#7D5A50;font-size:12pt;margin:10px 0 5px;border-bottom:1px solid #E8D5C4;padding-bottom:3px}h3{color:#7D5A50;font-size:11pt;margin:8px 0 4px}.columns{display:flex;gap:20px;}.column{width:48%}.section{margin-bottom:10px}.item{margin-bottom:4px}.item-label{font-weight:700;color:#5D4037}.item-value{margin-left:3px}.footer{text-align:center;margin-top:14px;font-size:9pt;color:#7D5A50;font-style:italic;border-top:1px solid #E8D5C4;padding-top:10px}.baby-icon{text-align:center;margin:8px auto}.baby-icon img{height:46px}</style>
      </head><body><div class="container"><div class="header"><h1>Mein Geburtsplan</h1><p>Erstellt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p></div>
      <div class="columns"><div class="column left-column">${formatContentForHTMLLeftColumn(content)}</div><div class="column right-column">${formatContentForHTMLRightColumn(content)}</div></div>
      <div class="footer">${babyIconBase64 ? `<div class="baby-icon"><img src="data:image/png;base64,${babyIconBase64}" alt="Baby Icon" /></div>` : ''}<p>Dieser Geburtsplan wurde mit der Wehen-Tracker App erstellt.</p></div></div></body></html>`;
    }

    // Generiere das PDF mit expo-print
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    // Teile die PDF-Datei
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Geburtsplan als PDF speichern',
        UTI: 'com.adobe.pdf'
      });
    } else {
      Alert.alert('Teilen nicht verfügbar', 'Das Teilen von Dateien wird auf diesem Gerät nicht unterstützt.');
    }

  } catch (error) {
    console.error('Fehler beim Generieren des PDFs:', error);
    Alert.alert('Fehler', 'Der Geburtsplan konnte nicht als PDF gespeichert werden.');
  } finally {
    if (setIsGeneratingPDF) {
      setIsGeneratingPDF(false);
    }
  }
};
