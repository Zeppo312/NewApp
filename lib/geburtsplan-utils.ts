import { Alert, Platform } from 'react-native';
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
  `<div class="option ${checked ? 'checked' : ''}"><span class="box">${checked ? '☑' : '☐'}</span><span class="opt-label">${escapeHtml(label)}</span></div>`;

const renderOptions = (all: string[], selected: string[] = []) =>
  `<div class="options">${all.map((o) => renderOption(o, selected.includes(o))).join('')}</div>`;

// Erstelle ein schönes, strukturiertes HTML direkt aus structured_data
const buildHtmlFromStructuredData = (data: any, babyIconBase64?: string | null) => {
  // Brand (nach deinem Design-Guide: kein Blau, Lila + warmes Beige)
  const colorBg = '#f5eee0';
  const colorCard = '#FFFFFF';
  const colorBorder = 'rgba(125, 90, 80, 0.18)';
  const colorTitle = '#6B4C44';
  const colorAccent = '#5E3DB3'; // <- Brand Purple
  const colorText = '#3F3330';

  const createdAt = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const metaRows: Array<{ label: string; value: string }> = [
    { label: 'Name der Mutter', value: data?.allgemeineAngaben?.mutterName || '' },
    { label: 'Entbindungstermin (ET)', value: data?.allgemeineAngaben?.entbindungstermin || '' },
    { label: 'Geburtsklinik / Hausgeburt', value: data?.allgemeineAngaben?.geburtsklinik || '' },
    { label: 'Begleitperson(en)', value: data?.allgemeineAngaben?.begleitpersonen || '' },
  ];

  // Kurzfassung (oben auf Seite 1)
  const gp = data?.geburtsWuensche || {};
  const ndg = data?.nachDerGeburt || {};
  const mi = data?.medizinischeEingriffe || {};

  const summary = [
    { k: 'Schmerzmittel', v: (gp.schmerzmittel?.[0] || gp.schmerzmittel) ? (Array.isArray(gp.schmerzmittel) ? gp.schmerzmittel.join(', ') : String(gp.schmerzmittel)) : '–' },
    { k: 'Positionen', v: gp.geburtspositionen?.length ? gp.geburtspositionen.join(', ') : '–' },
    { k: 'Begleitperson', v: gp.rolleBegleitperson || '–' },
    { k: 'Bonding', v: ndg.bonding ? 'Ja' : 'Nein/–' },
    { k: 'Stillen', v: ndg.stillen ? 'Ja' : 'Nein/–' },
    { k: 'Monitoring', v: mi.monitoring || '–' },
  ];

  const section = (num: string, title: string, bodyHtml: string) => `
    <section class="section">
      <div class="section-title">
        <span class="pill">${escapeHtml(num)}</span>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="card">
        ${bodyHtml}
      </div>
    </section>
  `;

  // Option-Renderer: 2 Spalten via CSS columns (print-freundlicher als Grid)
  const renderOption = (label: string, checked: boolean) =>
    `<div class="option ${checked ? 'checked' : ''}">
      <span class="box">${checked ? '✓' : ''}</span>
      <span class="opt-label">${escapeHtml(label)}</span>
    </div>`;

  const renderOptions = (all: string[], selected: string[] = []) =>
    `<div class="options">${all.map((o) => renderOption(o, selected.includes(o))).join('')}</div>`;

  const free = (text?: string) =>
    `<div class="free-text">${text && String(text).trim() ? escapeHtml(text) : '–'}</div>`;

  const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mein Geburtsplan</title>
    <style>
      @page { size: A4; margin: 2.2cm 1.5cm 1.5cm 1.5cm; } /* more top space */

      :root{
        --bg:${colorBg};
        --card:${colorCard};
        --border:${colorBorder};
        --title:${colorTitle};
        --accent:${colorAccent};
        --text:${colorText};
        --muted: rgba(63,51,48,0.55);
      }

      *{ box-sizing:border-box; }
      body{
        margin:0;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
        background:var(--bg);
        color:var(--text);
        font-size:10.5pt;
        line-height:1.55;
      }

      /* Print-break robustness */
      .section, .card, .group, .option{
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .container{ width:100%; }

      /* Header (ruhiger, wertiger, ohne absolute overlaps) */
      .header{
        padding: 14px 12px 12px; /* a bit more breathing room */
        border-bottom:1px solid var(--border);
        margin-bottom: 14px;
      }
      .header-top{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }
      .brand{
        display:flex;
        align-items:center;
        gap:8px;
        font-weight:800;
        color:var(--accent);
        letter-spacing:0.2px;
        font-size:9.5pt;
      }
      .dot{
        width:8px;height:8px;border-radius:999px;background:var(--accent);
      }
      .created{
        color:var(--muted);
        font-size:9pt;
        white-space:nowrap;
      }

      .hero{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:14px;
        margin-top: 10px;
      }
      .title-wrap h1{
        margin:0;
        font-size:22pt;
        letter-spacing:-0.3px;
        color:var(--title);
      }
      .subtitle{
        margin-top:4px;
        color:var(--muted);
        font-size:10pt;
      }
      .baby-icon img{ height:44px; }

      /* Cards */
      .card{
        background:var(--card);
        border:1px solid var(--border);
        border-radius:14px;
        padding: 12px 14px;
        position:relative;
        overflow:hidden;
      }
      .card:before{
        content:"";
        position:absolute;
        left:0; top:0; bottom:0;
        width:4px;
        background:var(--accent);
        opacity:0.25;
      }

      /* Meta + Summary grid */
      .two{
        display:grid;
        grid-template-columns: 1.2fr 1fr;
        gap:12px;
      }
      .kv{
        display:grid;
        grid-template-columns: 1.1fr 1fr;
        gap:6px 10px;
      }
      .kv .k{ color:var(--title); font-weight:700; }
      .kv .v{ color:var(--text); }

      .summary{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap:8px 10px;
      }
      .sitem{
        border:1px solid rgba(94,61,179,0.18);
        border-radius:12px;
        padding:8px 10px;
        background: rgba(94,61,179,0.06);
      }
      .sitem .k{
        font-size:9pt;
        color:rgba(63,51,48,0.62);
        margin-bottom:2px;
      }
      .sitem .v{
        font-size:10.5pt;
        font-weight:650;
        color:var(--text);
      }

      /* Section title */
      .section{ margin: 18px 0; }
      .section-title{
        display:flex;
        align-items:center;
        gap:10px;
        margin: 0 0 10px;
      }
      .section-title h2{
        margin:0;
        font-size:14pt;
        font-weight:800;
        color:var(--title);
      }
      .pill{
        width:22px;height:22px;border-radius:999px;
        display:inline-flex;align-items:center;justify-content:center;
        background: rgba(94,61,179,0.12);
        color: var(--accent);
        font-weight:800;
        font-size:10pt;
      }

      .group{ margin-bottom: 14px; }
      .group h3{
        margin: 0 0 8px;
        font-size:11.5pt;
        font-weight:750;
        color:var(--title);
      }

      /* Options: multi-column (print-stabiler als grid; grid + page breaks ist teils buggy) */
      .options{
        column-count:2;
        column-gap:12px;
      }
      .option{
        display:flex;
        align-items:center;
        gap:8px;
        padding:6px 8px;
        border-radius:10px;
        border:1px solid rgba(125,90,80,0.16);
        margin: 0 0 8px;
        -webkit-column-break-inside: avoid;
      }
      .option.checked{
        border-color: rgba(94,61,179,0.45);
        background: rgba(94,61,179,0.08);
      }
      .box{
        width:16px;height:16px;border-radius:5px;
        border:1.5px solid rgba(63,51,48,0.35);
        display:inline-flex;align-items:center;justify-content:center;
        font-size:11pt;
        line-height:1;
        font-weight:900;
        color: var(--accent);
        flex: 0 0 auto;
      }
      .option.checked .box{
        border-color: rgba(94,61,179,0.75);
        background: rgba(94,61,179,0.12);
      }
      .opt-label{ font-size:10pt; }

      .free-text{
        border-left: 4px solid var(--accent);
        background: rgba(94,61,179,0.06);
        padding: 10px 10px;
        border-radius: 10px;
        font-style: italic;
      }

      .footer{
        margin-top: 22px;
        padding-top: 10px;
        border-top:1px solid var(--border);
        text-align:center;
        color:var(--muted);
        font-size:8.5pt;
      }
    </style>
  </head>

  <body>
    <div class="container">

      <div class="header">
        <div class="header-top">
          <div class="brand"><span class="dot"></span><span>LottiBaby App</span></div>
          <div class="created">Erstellt am ${createdAt}</div>
        </div>

        <div class="hero">
          <div class="title-wrap">
            <h1>Mein Geburtsplan</h1>
            <div class="subtitle">Kurz & klar für Hebamme / Klinik – alle Details darunter</div>
          </div>
          ${babyIconBase64 ? `<div class="baby-icon"><img src="data:image/png;base64,${babyIconBase64}" alt="Baby"/></div>` : ''}
        </div>
      </div>

      ${section('1', 'Allgemeine Angaben', `
        <div class="two">
          <div class="card" style="padding:12px 14px;">
            <div class="kv">
              ${metaRows.map(r => `
                <div class="k">${escapeHtml(r.label)}</div>
                <div class="v">${r.value && String(r.value).trim() ? escapeHtml(r.value) : '–'}</div>
              `).join('')}
            </div>
          </div>

          <div class="card" style="padding:12px 14px;">
            <div style="font-weight:800;color:${colorTitle};margin-bottom:8px;">Klinik-Kurzfassung</div>
            <div class="summary">
              ${summary.map(s => `
                <div class="sitem">
                  <div class="k">${escapeHtml(s.k)}</div>
                  <div class="v">${escapeHtml(s.v)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `)}

      ${(() => {
        const gp = data?.geburtsWuensche || {};
        const posOpts = ['Stehend', 'Hocken', 'Vierfüßler', 'im Wasser', 'flexibel'];
        const painOpts = ['Ohne Schmerzmittel', 'PDA', 'TENS', 'Lachgas', 'offen für alles'];
        const rolleOpts = ['Aktiv unterstützen', 'eher passiv', 'jederzeit ansprechbar'];
        const atmosOpts = ['Eigene Musik', 'ruhige Umgebung', 'gedimmtes Licht'];
        return section('2', 'Wünsche zur Geburt', `
          <div class="group"><h3>Geburtspositionen</h3>${renderOptions(posOpts, gp.geburtspositionen || [])}</div>
          <div class="group"><h3>Schmerzmittel</h3>${renderOptions(painOpts, gp.schmerzmittel || [])}</div>
          <div class="group"><h3>Rolle der Begleitperson</h3>${renderOptions(rolleOpts, gp.rolleBegleitperson ? [gp.rolleBegleitperson] : [])}</div>
          <div class="group"><h3>Musik / Atmosphäre</h3>${renderOptions(atmosOpts, gp.musikAtmosphaere || [])}</div>
          <div class="group"><h3>Sonstige Wünsche</h3>${free(gp.sonstigeWuensche)}</div>
        `);
      })()}

      ${(() => {
        const mi = data?.medizinischeEingriffe || {};
        const wehenOpts = ['Nur wenn medizinisch nötig', 'keine künstliche Einleitung', 'Offen für medizinische Empfehlungen'];
        const dammOpts = ['Möglichst vermeiden', 'akzeptabel wenn notwendig', 'Nach ärztlicher Empfehlung'];
        const monOpts = ['Mobil bleiben, CTG nur zeitweise', 'Dauer-CTG ok', 'Nach medizinischer Notwendigkeit'];
        const notOpts = ['Nur als letzte Option', 'offen dafür', 'Nach medizinischer Notwendigkeit'];
        return section('3', 'Medizinische Eingriffe & Maßnahmen', `
          <div class="group"><h3>Wehenförderung</h3>${renderOptions(wehenOpts, mi.wehenfoerderung ? [mi.wehenfoerderung] : [])}</div>
          <div class="group"><h3>Dammschnitt / -massage</h3>${renderOptions(dammOpts, mi.dammschnitt ? [mi.dammschnitt] : [])}</div>
          <div class="group"><h3>Monitoring</h3>${renderOptions(monOpts, mi.monitoring ? [mi.monitoring] : [])}</div>
          <div class="group"><h3>Notkaiserschnitt</h3>${renderOptions(notOpts, mi.notkaiserschnitt ? [mi.notkaiserschnitt] : [])}</div>
          <div class="group"><h3>Sonstige Eingriffe</h3>${free(mi.sonstigeEingriffe)}</div>
        `);
      })()}

      ${(() => {
        const ndg = data?.nachDerGeburt || {};
        const boolRow = (val: boolean) => renderOptions(['Ja', 'Nein'], [val ? 'Ja' : 'Nein']);
        const plazentaOpts = ['Natürlich gebären', 'keine Routine-Injektion', 'Nach medizinischer Empfehlung'];
        const vitKOpts = ['Ja', 'Nein', 'Besprechen'];
        return section('4', 'Nach der Geburt', `
          <div class="group"><h3>Bonding</h3>${boolRow(!!ndg.bonding)}</div>
          <div class="group"><h3>Stillen</h3>${boolRow(!!ndg.stillen)}</div>
          <div class="group"><h3>Plazenta</h3>${renderOptions(plazentaOpts, ndg.plazenta ? [ndg.plazenta] : [])}</div>
          <div class="group"><h3>Vitamin-K-Gabe fürs Baby</h3>${renderOptions(vitKOpts, ndg.vitaminKGabe ? [ndg.vitaminKGabe] : [])}</div>
          <div class="group"><h3>Sonstige Wünsche</h3>${free(ndg.sonstigeWuensche)}</div>
        `);
      })()}

      ${(() => {
        const nf = data?.notfall || {};
        const beglOpts = ['Ja', 'Nein', 'wenn möglich'];
        const fotoOpts = ['Ja', 'Nein', 'nur nach Absprache'];
        const boolRow = (val: boolean) => renderOptions(['Ja', 'Nein'], [val ? 'Ja' : 'Nein']);
        return section('5', 'Für den Notfall / Kaiserschnitt', `
          <div class="group"><h3>Begleitperson im OP</h3>${renderOptions(beglOpts, nf.begleitpersonImOP ? [nf.begleitpersonImOP] : [])}</div>
          <div class="group"><h3>Bonding im OP</h3>${boolRow(!!nf.bondingImOP)}</div>
          <div class="group"><h3>Fotoerlaubnis</h3>${renderOptions(fotoOpts, nf.fotoerlaubnis ? [nf.fotoerlaubnis] : [])}</div>
          <div class="group"><h3>Sonstige Wünsche</h3>${free(nf.sonstigeWuensche)}</div>
        `);
      })()}

      ${section('6', 'Sonstige Hinweise', `${free(data?.sonstigeWuensche?.freitext)}`)}

      <div class="footer">
        <div><strong>LottiBaby App</strong> — Liebe. Klarheit. Überblick.</div>
        <div>Dieser Geburtsplan wurde mit der LottiBaby App erstellt.</div>
      </div>
    </div>
  </body>
</html>
`;

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
      <div class="footer">${babyIconBase64 ? `<div class="baby-icon"><img src="data:image/png;base64,${babyIconBase64}" alt="Baby Icon" /></div>` : ''}<p>Dieser Geburtsplan wurde mit der LottiBaby App erstellt.</p></div></div></body></html>`;
    }

    // Generiere das PDF mit expo-print
    const printOptions: Print.PrintToFileOptions = {
      html: htmlContent,
      base64: false,
      ...(Platform.OS === 'ios'
        ? {
            margins: {
              left: 24,
              right: 24,
              top: 72,   // <- more space at very top
              bottom: 40,
            },
          }
        : {}),
    };

    const { uri } = await Print.printToFileAsync(printOptions);

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
