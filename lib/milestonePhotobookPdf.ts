import {
  addMonths,
  addYears,
  differenceInCalendarDays,
  differenceInMonths,
  differenceInYears,
} from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import type { BabyMilestoneEntry } from './milestones';

type MilestonePhotobookPdfOptions = {
  entries: BabyMilestoneEntry[];
  babyName?: string | null;
  birthDate?: string | null;
};

export type MilestonePhotobookPdfResult = {
  uri: string;
  pageCount: number;
  warnings: string[];
};

const escapeHtml = (value: string | null | undefined) =>
  (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fromDateOnly = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatAlbumDate = (value: string) =>
  new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fromDateOnly(value));

const joinGermanParts = (parts: string[]) => {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} und ${parts.at(-1)}`;
};

const formatBabyAgeAtMilestone = (birthDateValue: string | null | undefined, eventDateValue: string) => {
  if (!birthDateValue) return null;

  const birthDate = fromDateOnly(birthDateValue);
  const milestoneDate = fromDateOnly(eventDateValue);
  if (
    Number.isNaN(birthDate.getTime()) ||
    Number.isNaN(milestoneDate.getTime()) ||
    milestoneDate < birthDate
  ) {
    return null;
  }

  const years = differenceInYears(milestoneDate, birthDate);
  const afterYears = addYears(birthDate, years);
  const months = differenceInMonths(milestoneDate, afterYears);
  const afterMonths = addMonths(afterYears, months);
  const days = differenceInCalendarDays(milestoneDate, afterMonths);
  const parts = [
    years > 0 ? `${years} ${years === 1 ? 'Jahr' : 'Jahren'}` : null,
    months > 0 ? `${months} ${months === 1 ? 'Monat' : 'Monaten'}` : null,
    days > 0 ? `${days} ${days === 1 ? 'Tag' : 'Tagen'}` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? `Mit ${joinGermanParts(parts)}` : 'Am Tag der Geburt';
};

const safeFilePart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'baby';

const imageToDataUri = async (sourceUri: string, localUri: string) => {
  if (sourceUri.startsWith('data:image/')) return sourceUri;

  let readableUri = sourceUri;
  if (!sourceUri.startsWith('file://')) {
    const download = await FileSystem.downloadAsync(sourceUri, localUri);
    readableUri = download.uri;
  }

  const base64 = await FileSystem.readAsStringAsync(readableUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/jpeg;base64,${base64}`;
};

export const buildMilestonePhotobookHtml = ({
  entries,
  babyName,
  birthDate,
  imageDataUris,
}: MilestonePhotobookPdfOptions & { imageDataUris: Record<string, string | null> }) => {
  const sortedEntries = [...entries].sort((left, right) =>
    left.event_date.localeCompare(right.event_date)
  );
  const displayName = babyName?.trim() || 'unserem Baby';
  const firstDate = sortedEntries[0]?.event_date;
  const lastDate = sortedEntries.at(-1)?.event_date;
  const dateRange = firstDate
    ? firstDate === lastDate
      ? formatAlbumDate(firstDate)
      : `${formatAlbumDate(firstDate)} bis ${formatAlbumDate(lastDate ?? firstDate)}`
    : '';
  const coverEntry = sortedEntries.find((entry) => Boolean(imageDataUris[entry.id]));
  const coverImageDataUri = coverEntry ? imageDataUris[coverEntry.id] : null;

  const milestonePages = sortedEntries
    .map((entry, index) => {
      const imageDataUri = imageDataUris[entry.id];
      const babyAge = formatBabyAgeAtMilestone(birthDate, entry.event_date);
      const notes = entry.notes?.trim();
      const titleClass = entry.title.length > 48
        ? 'title-small'
        : entry.title.length > 30
          ? 'title-medium'
          : '';
      const longNoteClass = notes && notes.length > 240 ? 'has-long-note' : '';
      const noteClass = notes && notes.length > 340 ? 'notes notes-compact' : 'notes';
      const pageStyle = `page-style-${(index % 4) + 1}`;

      return `
        <section class="page milestone-page ${pageStyle} ${longNoteClass}">
          <div class="album-binding"></div>
          <div class="decoration decoration-top"></div>
          <div class="decoration decoration-bottom"></div>
          <header class="milestone-header">
            <div class="eyebrow">ERINNERUNG VON ${escapeHtml(displayName.toUpperCase())}</div>
            <h1 class="milestone-title ${titleClass}">${escapeHtml(entry.title)}</h1>
            <div class="title-flourish"><span></span><b>&#10022;</b><span></span></div>
          </header>

          <div class="photo-stage">
            ${imageDataUri
              ? `<div class="photo-frame"><img src="${imageDataUri}" alt="${escapeHtml(entry.title)}" /></div>`
              : `<div class="photo-placeholder"><div class="placeholder-star">&#10022;</div><div>Ein besonderer Moment</div></div>`}
          </div>

          <div class="caption-card">
            <div class="caption-date-row">
              <div class="date">${escapeHtml(formatAlbumDate(entry.event_date))}</div>
              ${babyAge ? `<div class="age-pill">${escapeHtml(babyAge)}</div>` : ''}
            </div>
            ${notes ? `<div class="${noteClass}">${escapeHtml(notes)}</div>` : '<div class="caption-line"></div>'}
          </div>

          <div class="memory-lines">
            <div class="memory-lines-heading"><span>FÜR EURE GEDANKEN</span><b>&#10022;</b></div>
            <div class="writing-line"></div>
            <div class="writing-line"></div>
            <div class="writing-line"></div>
          </div>

          <footer class="page-footer">
            <span class="page-number">SEITE ${String(index + 1).padStart(2, '0')}</span>
          </footer>
        </section>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @page { size: A4 portrait; margin: 0; }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body { margin: 0; padding: 0; background: #f8e9dd; color: #5d4033; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            -webkit-font-smoothing: antialiased;
          }
          .page {
            position: relative;
            width: 210mm;
            height: 297mm;
            overflow: hidden;
            page-break-after: always;
            break-after: page;
            background: linear-gradient(145deg, #fff9f4 0%, #f8e8dc 58%, #f5e2d5 100%);
          }
          .page:last-child { page-break-after: auto; break-after: auto; }
          .page::after {
            content: "";
            position: absolute;
            inset: 7mm;
            border: 1px solid rgba(112, 76, 58, 0.10);
            pointer-events: none;
          }
          .album-binding {
            position: absolute;
            z-index: 3;
            left: 0;
            top: 0;
            bottom: 0;
            width: 5mm;
            background: linear-gradient(90deg, #c79f8a 0%, #e3c6b6 58%, rgba(227, 198, 182, 0.18) 100%);
          }
          .decoration { position: absolute; border-radius: 999px; pointer-events: none; }
          .decoration-top {
            width: 86mm;
            height: 86mm;
            right: -37mm;
            top: -39mm;
            background: #eadbea;
          }
          .decoration-bottom {
            width: 66mm;
            height: 66mm;
            left: -31mm;
            bottom: -33mm;
            background: #efd4c1;
          }
          .cover {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 25mm 22mm 19mm 27mm;
          }
          .cover-heading { position: relative; z-index: 2; }
          .cover-kicker { font-size: 9pt; font-weight: 800; letter-spacing: 3.1pt; color: #a27663; }
          .cover-title {
            margin: 7mm 0 0;
            font: 700 39pt/1.02 Georgia, "Times New Roman", serif;
            letter-spacing: -0.5pt;
          }
          .cover-subtitle {
            max-width: 145mm;
            margin-top: 4mm;
            font-size: 13pt;
            line-height: 1.45;
            color: #8f7569;
          }
          .cover-photo-wrap {
            position: relative;
            z-index: 2;
            height: 126mm;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .cover-photo-mark {
            position: relative;
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(93, 64, 51, 0.12);
            background: #fffdfb;
            box-shadow: 0 5mm 12mm rgba(70, 45, 34, 0.16);
            transform: rotate(-1.2deg);
          }
          .cover-photo-filled { padding: 5mm 5mm 8mm; }
          .cover-photo-filled img {
            display: block;
            width: auto;
            height: auto;
            max-width: 140mm;
            max-height: 105mm;
            object-fit: contain;
          }
          .cover-photo-empty { width: 126mm; height: 108mm; padding: 7mm; }
          .cover-photo-caption {
            padding-top: 3.5mm;
            font: italic 10pt/1.2 Georgia, "Times New Roman", serif;
            color: #8d7164;
          }
          .cover-tape {
            position: absolute;
            z-index: 4;
            width: 36mm;
            height: 9mm;
            left: 50%;
            top: -5mm;
            transform: translateX(-50%) rotate(1.5deg);
            background: rgba(230, 205, 177, 0.82);
          }
          .cover-monogram {
            width: 47mm;
            height: 47mm;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #e7d8ec;
            color: #684f5e;
            font: 700 31pt Georgia, "Times New Roman", serif;
          }
          .cover-meta {
            position: relative;
            z-index: 2;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 12mm;
          }
          .cover-count-pill {
            display: inline-block;
            padding: 3mm 5mm;
            border-radius: 999px;
            background: #e7d8ec;
            color: #684f5e;
            font: 700 12pt Georgia, "Times New Roman", serif;
          }
          .cover-range { margin-top: 2.5mm; padding-left: 1mm; font-size: 9pt; color: #8f7569; }
          .brand { font-size: 8.5pt; font-weight: 800; letter-spacing: 2.2pt; color: #ac9286; }
          .milestone-page {
            display: flex;
            flex-direction: column;
            padding: 31mm 18mm 15mm 23mm;
          }
          .page-style-2 {
            background: linear-gradient(150deg, #fcf8fb 0%, #f3e8f2 56%, #f7e9df 100%);
          }
          .page-style-2 .decoration-top {
            right: auto;
            left: -42mm;
            top: -44mm;
            background: #efd9dd;
          }
          .page-style-2 .decoration-bottom {
            left: auto;
            right: -27mm;
            bottom: -38mm;
            background: #dfd7eb;
          }
          .page-style-2 .milestone-header { text-align: center; }
          .page-style-2 .title-flourish { margin-left: auto; margin-right: auto; }
          .page-style-2 .photo-frame { transform: rotate(-0.9deg); }
          .page-style-2 .photo-frame::before {
            left: 23%;
            transform: translateX(-50%) rotate(-5deg);
            background: rgba(216, 193, 211, 0.78);
          }
          .page-style-2 .caption-card {
            margin: 0 4mm;
            border-left: 0;
            border-top: 2mm solid #cbb5cf;
            text-align: center;
          }
          .page-style-2 .caption-date-row { justify-content: center; }
          .page-style-2 .caption-line { margin-left: auto; margin-right: auto; }
          .page-style-3 {
            background: linear-gradient(145deg, #fffaf2 0%, #f5e7d4 62%, #edddce 100%);
          }
          .page-style-3 .decoration-top {
            width: 70mm;
            height: 58mm;
            right: -28mm;
            top: -25mm;
            border-radius: 0 0 0 58mm;
            background: #e7cfc2;
          }
          .page-style-3 .decoration-bottom {
            width: 82mm;
            height: 82mm;
            left: -49mm;
            bottom: -44mm;
            background: #e9d6b9;
          }
          .page-style-3 .milestone-header { text-align: right; }
          .page-style-3 .title-flourish { margin-left: auto; }
          .page-style-3 .photo-stage { justify-content: flex-start; padding-left: 7mm; }
          .page-style-3 .photo-frame {
            transform: rotate(0.8deg);
            box-shadow: 2mm 3mm 8mm rgba(70, 45, 34, 0.15);
          }
          .page-style-3 .photo-frame::before {
            left: 77%;
            transform: translateX(-50%) rotate(4deg);
            background: rgba(225, 198, 159, 0.78);
          }
          .page-style-3 .caption-card {
            border-left-color: #cba986;
            border-radius: 0 4mm 4mm 0;
          }
          .page-style-3 .writing-line { border-bottom-style: dashed; }
          .page-style-4 {
            background: linear-gradient(140deg, #fffaf7 0%, #eee7f2 57%, #f6e5df 100%);
          }
          .page-style-4 .decoration-top {
            width: 62mm;
            height: 62mm;
            right: -24mm;
            top: -25mm;
            border-radius: 14mm;
            transform: rotate(14deg);
            background: #dfd5e9;
          }
          .page-style-4 .decoration-bottom {
            width: 58mm;
            height: 58mm;
            left: -24mm;
            bottom: -28mm;
            border-radius: 17mm;
            transform: rotate(-12deg);
            background: #edced0;
          }
          .page-style-4 .photo-stage { justify-content: flex-end; padding-right: 5mm; }
          .page-style-4 .photo-frame {
            padding: 5mm;
            border: 1px solid rgba(111, 83, 103, 0.18);
            border-radius: 5mm;
            background: #fdfafd;
            box-shadow: 0 3mm 9mm rgba(70, 45, 58, 0.15);
          }
          .page-style-4 .photo-frame::before { display: none; }
          .page-style-4 .photo-frame img { border-radius: 2.5mm; }
          .page-style-4 .caption-card {
            border-left: 0;
            border-right: 2.5mm solid #bda9ca;
            border-radius: 4mm 0 0 4mm;
            background: rgba(250, 247, 252, 0.90);
          }
          .page-style-4 .age-pill { background: #e9e0ee; }
          .page-style-4 .writing-line { border-bottom-style: dotted; }
          .milestone-header { flex: 0 0 auto; position: relative; z-index: 1; }
          .eyebrow { font-size: 7.5pt; line-height: 1.2; font-weight: 800; letter-spacing: 2.3pt; color: #a27663; }
          .milestone-title {
            margin: 3.5mm 0 0;
            overflow: visible;
            overflow-wrap: anywhere;
            hyphens: auto;
            font: 700 29pt/1.1 Georgia, "Times New Roman", serif;
            letter-spacing: -0.25pt;
          }
          .milestone-title.title-medium { font-size: 25pt; line-height: 1.12; }
          .milestone-title.title-small { font-size: 21pt; line-height: 1.15; }
          .title-flourish {
            width: 46mm;
            margin-top: 4mm;
            display: flex;
            align-items: center;
            gap: 2.5mm;
            color: #b18b78;
          }
          .title-flourish span { flex: 1; height: 1px; background: #ddc4b5; }
          .title-flourish b { font-size: 9pt; font-weight: 400; }
          .photo-stage {
            flex: 1 1 auto;
            min-height: 0;
            padding: 7mm 0 5.5mm;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .photo-frame {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            max-width: 169mm;
            max-height: 150mm;
            padding: 4mm 4mm 7mm;
            background: #fffdfc;
            box-shadow: 0 3mm 8mm rgba(70, 45, 34, 0.16);
          }
          .photo-frame::before {
            content: "";
            position: absolute;
            z-index: 2;
            width: 32mm;
            height: 7mm;
            left: 50%;
            top: -4mm;
            transform: translateX(-50%) rotate(-1deg);
            background: rgba(230, 205, 177, 0.76);
          }
          .photo-frame img {
            display: block;
            width: auto;
            height: auto;
            max-width: 161mm;
            max-height: 121mm;
            object-fit: contain;
          }
          .has-long-note .photo-frame img { max-height: 101mm; }
          .photo-placeholder {
            width: 100%;
            height: 104mm;
            display: flex;
            flex-direction: column;
            gap: 4mm;
            align-items: center;
            justify-content: center;
            border: 1px dashed #cbb0c9;
            background: #eee3ef;
            color: #8a6a5c;
            font-size: 12pt;
            font-weight: 700;
          }
          .placeholder-star { font-size: 28pt; color: #9a7665; }
          .caption-card {
            position: relative;
            z-index: 2;
            flex: 0 0 auto;
            padding: 5mm 6mm 5mm;
            border-left: 2.5mm solid #d6b3bf;
            background: rgba(255, 253, 251, 0.82);
          }
          .caption-date-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6mm;
          }
          .date { font: 700 16pt/1.25 Georgia, "Times New Roman", serif; }
          .age-pill {
            flex: 0 0 auto;
            max-width: 78mm;
            padding: 2mm 3.5mm;
            border-radius: 999px;
            background: #f0e2dc;
            color: #846b60;
            font-size: 8.5pt;
            line-height: 1.25;
            font-weight: 700;
            text-align: center;
          }
          .notes {
            margin-top: 3mm;
            overflow: visible;
            overflow-wrap: anywhere;
            hyphens: auto;
            font-size: 10.5pt;
            line-height: 1.42;
            color: #765d52;
          }
          .notes-compact { font-size: 9pt; line-height: 1.35; }
          .caption-line { width: 54mm; height: 1px; margin-top: 5mm; background: #ddc9bd; }
          .memory-lines {
            position: relative;
            z-index: 2;
            flex: 0 0 auto;
            margin-top: 5mm;
            padding: 0 2mm;
          }
          .memory-lines-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1mm;
            color: #a27663;
          }
          .memory-lines-heading span {
            font-size: 6.7pt;
            font-weight: 800;
            letter-spacing: 1.7pt;
          }
          .memory-lines-heading b {
            font-size: 8pt;
            font-weight: 400;
            color: #b18b78;
          }
          .writing-line {
            height: 7mm;
            border-bottom: 1px solid rgba(162, 118, 99, 0.32);
          }
          .page-footer {
            position: relative;
            z-index: 2;
            flex: 0 0 auto;
            padding-top: 5mm;
            display: flex;
            justify-content: flex-end;
            align-items: center;
          }
          .page-number { font-size: 7.5pt; font-weight: 800; letter-spacing: 1.7pt; color: #ac9286; }
        </style>
      </head>
      <body>
        <section class="page cover">
          <div class="album-binding"></div>
          <div class="decoration decoration-top"></div>
          <div class="decoration decoration-bottom"></div>
          <div class="cover-heading">
            <div class="cover-kicker">LOTTI BABY FOTOBUCH</div>
            <h1 class="cover-title">Unsere<br />Meilensteine</h1>
            <div class="cover-subtitle">Die ersten Male und besonderen Momente von ${escapeHtml(displayName)}.</div>
          </div>
          <div class="cover-photo-wrap">
            ${coverImageDataUri
              ? `<div class="cover-photo-mark cover-photo-filled"><div class="cover-tape"></div><img src="${coverImageDataUri}" alt="${escapeHtml(coverEntry?.title)}" /><div class="cover-photo-caption">Unser Fotobuch</div></div>`
              : `<div class="cover-photo-mark cover-photo-empty"><div class="cover-monogram">${escapeHtml(displayName.slice(0, 1).toUpperCase())}</div><div class="cover-photo-caption">Unsere Geschichte</div></div>`}
          </div>
          <div class="cover-meta">
            <div>
              <div class="cover-count-pill">${sortedEntries.length} ${sortedEntries.length === 1 ? 'Erinnerung' : 'Erinnerungen'}</div>
              ${dateRange ? `<div class="cover-range">${escapeHtml(dateRange)}</div>` : ''}
            </div>
            <div class="brand">LOTTI BABY</div>
          </div>
        </section>
        ${milestonePages}
      </body>
    </html>`;
};

export const generateMilestonePhotobookPdf = async ({
  entries,
  babyName,
  birthDate,
}: MilestonePhotobookPdfOptions): Promise<MilestonePhotobookPdfResult> => {
  if (entries.length === 0) {
    throw new Error('Es sind noch keine Erinnerungen für das Fotobuch vorhanden.');
  }

  const cacheRoot = FileSystem.cacheDirectory;
  if (!cacheRoot) throw new Error('Das temporäre App-Verzeichnis ist nicht verfügbar.');

  const exportId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const imageDirectory = `${cacheRoot}milestone-photobook-${exportId}/`;
  const warnings: string[] = [];
  const imageDataUris: Record<string, string | null> = {};

  await FileSystem.makeDirectoryAsync(imageDirectory, { intermediates: true });

  try {
    for (const entry of entries) {
      if (!entry.image_url) {
        imageDataUris[entry.id] = null;
        continue;
      }

      try {
        imageDataUris[entry.id] = await imageToDataUri(
          entry.image_url,
          `${imageDirectory}${safeFilePart(entry.id)}.jpg`
        );
      } catch (error) {
        console.warn(`Foto für PDF konnte nicht geladen werden (${entry.id}):`, error);
        imageDataUris[entry.id] = null;
        warnings.push(`Das Foto zu „${entry.title}“ konnte nicht in das PDF übernommen werden.`);
      }
    }

    const html = buildMilestonePhotobookHtml({
      entries,
      babyName,
      birthDate,
      imageDataUris,
    });
    const generatedPdf = await Print.printToFileAsync({
      html,
      width: 595,
      height: 842,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    const fileName = `LottiBaby-Fotobuch-${safeFilePart(babyName || 'Baby')}-${Date.now()}.pdf`;
    const finalUri = `${cacheRoot}${fileName}`;
    await FileSystem.copyAsync({ from: generatedPdf.uri, to: finalUri });

    return {
      uri: finalUri,
      pageCount: entries.length + 1,
      warnings,
    };
  } finally {
    await FileSystem.deleteAsync(imageDirectory, { idempotent: true }).catch(() => undefined);
  }
};
