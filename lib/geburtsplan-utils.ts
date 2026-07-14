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
  const colorBg = '#FFF8F0';
  const colorCard = '#FFFFFF';
  const colorBorder = 'rgba(125, 90, 80, 0.15)';
  const colorTitle = '#7D5A50';
  const colorAccent = '#5E3DB3'; // <- Brand Purple
  const colorText = '#3F3330';
  const colorLightPurple = 'rgba(94, 61, 179, 0.08)';
  const colorPurpleBorder = 'rgba(94, 61, 179, 0.25)';

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
  // Zeigt nur ausgewählte Werte als Liste an
  const renderSelectedValues = (selected: string[] = []) => {
    if (!selected || selected.length === 0) return '<div class="no-selection">Keine Auswahl getroffen</div>';
    return `<div class="selected-values">${selected.map(val =>
      `<div class="selected-item">
        <span class="bullet">•</span>
        <span class="selected-text">${escapeHtml(val)}</span>
      </div>`
    ).join('')}</div>`;
  };

  const free = (text?: string) => {
    if (!text || !String(text).trim()) return '';
    return `<div class="free-text">${escapeHtml(text)}</div>`;
  };

  const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mein Geburtsplan</title>
    <style>
      @page { size: A4; margin: 2cm 1.5cm 1.8cm 1.5cm; }

      :root{
        --bg:${colorBg};
        --card:${colorCard};
        --border:${colorBorder};
        --title:${colorTitle};
        --accent:${colorAccent};
        --text:${colorText};
        --muted: rgba(63,51,48,0.55);
        --light-purple: ${colorLightPurple};
        --purple-border: ${colorPurpleBorder};
      }

      *{ box-sizing:border-box; }
      body{
        margin:0;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
        background:var(--bg);
        color:var(--text);
        font-size:10.5pt;
        line-height:1.6;
      }

      /* Print-break robustness */
      .section, .card, .group, .option{
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .container{ width:100%; max-width:100%; }

      /* Header - elegant and clear */
      .header{
        padding: 16px 14px 14px;
        border-bottom: 2px solid var(--purple-border);
        margin-bottom: 18px;
        background: linear-gradient(to bottom, rgba(255,255,255,0.5), transparent);
      }
      .header-top{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom: 12px;
      }
      .brand{
        display:flex;
        align-items:center;
        gap:9px;
        font-weight:800;
        color:var(--accent);
        letter-spacing:0.3px;
        font-size:10pt;
      }
      .dot{
        width:9px;height:9px;border-radius:999px;
        background:var(--accent);
        box-shadow: 0 0 0 3px var(--light-purple);
      }
      .created{
        color:var(--muted);
        font-size:9pt;
        font-weight:600;
        white-space:nowrap;
        padding:4px 10px;
        background:var(--light-purple);
        border-radius:6px;
      }

      .hero{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:16px;
      }
      .title-wrap h1{
        margin:0;
        font-size:24pt;
        letter-spacing:-0.4px;
        color:var(--title);
        font-weight:900;
      }
      .subtitle{
        margin-top:6px;
        color:var(--muted);
        font-size:10pt;
        font-weight:500;
      }
      .baby-icon img{ height:48px; opacity:0.95; }

      /* Cards - enhanced with subtle shadows */
      .card{
        background:var(--card);
        border:1.5px solid var(--border);
        border-radius:16px;
        padding: 14px 16px;
        position:relative;
        overflow:hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03);
      }
      .card:before{
        content:"";
        position:absolute;
        left:0; top:0; bottom:0;
        width:5px;
        background: linear-gradient(to bottom, var(--accent), rgba(94,61,179,0.6));
        opacity:0.35;
      }

      /* Meta grid - better organized */
      .kv{
        display:grid;
        grid-template-columns: 1.1fr 1fr;
        gap:10px 14px;
      }
      .kv .k{
        color:var(--title);
        font-weight:800;
        font-size:10pt;
      }
      .kv .v{
        color:var(--text);
        font-weight:600;
      }

      .summary{
        display:grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap:10px;
      }
      .sitem{
        border:1.5px solid var(--accent);
        border-radius:12px;
        padding:10px 12px;
        background: white;
        box-shadow: 0 2px 4px rgba(94,61,179,0.1);
      }
      .sitem .k{
        font-size:8.5pt;
        color:var(--accent);
        margin-bottom:4px;
        font-weight:700;
        text-transform:uppercase;
        letter-spacing:0.4px;
      }
      .sitem .v{
        font-size:10.5pt;
        font-weight:800;
        color:var(--text);
      }

      /* Section title - more prominent */
      .section{
        margin: 22px 0;
        padding-top: 6px;
      }
      .section-title{
        display:flex;
        align-items:center;
        gap:11px;
        margin: 0 0 12px;
        padding-bottom: 8px;
        border-bottom: 1.5px solid rgba(94,61,179,0.12);
      }
      .section-title h2{
        margin:0;
        font-size:15pt;
        font-weight:850;
        color:var(--title);
        letter-spacing:-0.2px;
      }
      .pill{
        width:26px;height:26px;border-radius:999px;
        display:inline-flex;align-items:center;justify-content:center;
        background: linear-gradient(135deg, var(--accent), rgba(94,61,179,0.85));
        color: white;
        font-weight:900;
        font-size:11pt;
        box-shadow: 0 2px 4px rgba(94,61,179,0.25);
        flex-shrink: 0;
      }

      .group{
        margin-bottom: 16px;
      }
      .group h3{
        margin: 0 0 10px;
        font-size:11.5pt;
        font-weight:800;
        color:var(--title);
        padding-left: 4px;
        border-left: 3px solid var(--accent);
      }

      /* Selected values - clean list display */
      .selected-values{
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .selected-item{
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 8px 10px;
        background: var(--light-purple);
        border-radius: 10px;
        border-left: 3px solid var(--accent);
      }
      .bullet{
        color: var(--accent);
        font-size: 14pt;
        font-weight: 900;
        line-height: 1.3;
        flex-shrink: 0;
      }
      .selected-text{
        color: var(--text);
        font-size: 10.5pt;
        font-weight: 600;
        line-height: 1.4;
      }
      .no-selection{
        color: var(--muted);
        font-style: italic;
        font-size: 10pt;
        padding: 8px 10px;
      }

      .free-text{
        border-left: 5px solid var(--accent);
        background: var(--light-purple);
        padding: 12px 14px;
        border-radius: 12px;
        font-style: italic;
        line-height: 1.7;
        color: var(--text);
        box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        border: 1.5px solid var(--purple-border);
        border-left-width: 5px;
      }

      .footer{
        margin-top: 28px;
        padding-top: 14px;
        border-top: 2px solid var(--purple-border);
        text-align:center;
        color:var(--muted);
        font-size:9pt;
        background: linear-gradient(to top, rgba(255,255,255,0.5), transparent);
        padding-bottom: 8px;
      }
      .footer strong{
        color: var(--accent);
        font-weight: 800;
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
            <div class="subtitle">Wichtigste Punkte auf einen Blick</div>
          </div>
          ${babyIconBase64 ? `<div class="baby-icon"><img src="data:image/png;base64,${babyIconBase64}" alt="Baby"/></div>` : ''}
        </div>
      </div>

      <!-- Kurzfassung ganz oben -->
      <div class="card" style="padding:14px 16px; margin-bottom: 20px; border-left-width: 5px;">
        <div style="font-weight:900;color:${colorTitle};margin-bottom:12px;font-size:13pt;">⭐ Wichtigste Punkte</div>
        <div class="summary">
          ${summary.map(s => `
            <div class="sitem">
              <div class="k">${escapeHtml(s.k)}</div>
              <div class="v">${escapeHtml(s.v)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      ${section('1', 'Allgemeine Angaben', `
        <div class="kv">
          ${metaRows.map(r => `
            <div class="k">${escapeHtml(r.label)}</div>
            <div class="v">${r.value && String(r.value).trim() ? escapeHtml(r.value) : '–'}</div>
          `).join('')}
        </div>
      `)}

      ${(() => {
        const gp = data?.geburtsWuensche || {};
        let content = '';

        if (gp.geburtspositionen && gp.geburtspositionen.length > 0) {
          content += `<div class="group"><h3>Geburtspositionen</h3>${renderSelectedValues(gp.geburtspositionen)}</div>`;
        }
        if (gp.schmerzmittel && gp.schmerzmittel.length > 0) {
          content += `<div class="group"><h3>Schmerzmittel</h3>${renderSelectedValues(gp.schmerzmittel)}</div>`;
        }
        if (gp.rolleBegleitperson) {
          content += `<div class="group"><h3>Rolle der Begleitperson</h3>${renderSelectedValues([gp.rolleBegleitperson])}</div>`;
        }
        if (gp.musikAtmosphaere && gp.musikAtmosphaere.length > 0) {
          content += `<div class="group"><h3>Musik / Atmosphäre</h3>${renderSelectedValues(gp.musikAtmosphaere)}</div>`;
        }
        const freitext = free(gp.sonstigeWuensche);
        if (freitext) {
          content += `<div class="group"><h3>Sonstige Wünsche</h3>${freitext}</div>`;
        }

        return content ? section('2', 'Wünsche zur Geburt', content) : '';
      })()}

      ${(() => {
        const mi = data?.medizinischeEingriffe || {};
        let content = '';

        if (mi.wehenfoerderung) {
          content += `<div class="group"><h3>Wehenförderung</h3>${renderSelectedValues([mi.wehenfoerderung])}</div>`;
        }
        if (mi.dammschnitt) {
          content += `<div class="group"><h3>Dammschnitt / -massage</h3>${renderSelectedValues([mi.dammschnitt])}</div>`;
        }
        if (mi.monitoring) {
          content += `<div class="group"><h3>Monitoring</h3>${renderSelectedValues([mi.monitoring])}</div>`;
        }
        if (mi.notkaiserschnitt) {
          content += `<div class="group"><h3>Notkaiserschnitt</h3>${renderSelectedValues([mi.notkaiserschnitt])}</div>`;
        }
        const freitext = free(mi.sonstigeEingriffe);
        if (freitext) {
          content += `<div class="group"><h3>Sonstige Eingriffe</h3>${freitext}</div>`;
        }

        return content ? section('3', 'Medizinische Eingriffe & Maßnahmen', content) : '';
      })()}

      ${(() => {
        const ndg = data?.nachDerGeburt || {};
        let content = '';

        if (ndg.bonding !== undefined && ndg.bonding !== null) {
          content += `<div class="group"><h3>Bonding</h3>${renderSelectedValues([ndg.bonding ? 'Ja' : 'Nein'])}</div>`;
        }
        if (ndg.stillen !== undefined && ndg.stillen !== null) {
          content += `<div class="group"><h3>Stillen</h3>${renderSelectedValues([ndg.stillen ? 'Ja' : 'Nein'])}</div>`;
        }
        if (ndg.plazenta) {
          content += `<div class="group"><h3>Plazenta</h3>${renderSelectedValues([ndg.plazenta])}</div>`;
        }
        if (ndg.vitaminKGabe) {
          content += `<div class="group"><h3>Vitamin-K-Gabe fürs Baby</h3>${renderSelectedValues([ndg.vitaminKGabe])}</div>`;
        }
        const freitext = free(ndg.sonstigeWuensche);
        if (freitext) {
          content += `<div class="group"><h3>Sonstige Wünsche</h3>${freitext}</div>`;
        }

        return content ? section('4', 'Nach der Geburt', content) : '';
      })()}

      ${(() => {
        const nf = data?.notfall || {};
        let content = '';

        if (nf.begleitpersonImOP) {
          content += `<div class="group"><h3>Begleitperson im OP</h3>${renderSelectedValues([nf.begleitpersonImOP])}</div>`;
        }
        if (nf.bondingImOP !== undefined && nf.bondingImOP !== null) {
          content += `<div class="group"><h3>Bonding im OP</h3>${renderSelectedValues([nf.bondingImOP ? 'Ja' : 'Nein'])}</div>`;
        }
        if (nf.fotoerlaubnis) {
          content += `<div class="group"><h3>Fotoerlaubnis</h3>${renderSelectedValues([nf.fotoerlaubnis])}</div>`;
        }
        const freitext = free(nf.sonstigeWuensche);
        if (freitext) {
          content += `<div class="group"><h3>Sonstige Wünsche</h3>${freitext}</div>`;
        }

        return content ? section('5', 'Für den Notfall / Kaiserschnitt', content) : '';
      })()}

      ${(() => {
        const freitext = free(data?.sonstigeWuensche?.freitext);
        if (!freitext) return '';
        return section('6', 'Sonstige Hinweise', freitext);
      })()}

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
