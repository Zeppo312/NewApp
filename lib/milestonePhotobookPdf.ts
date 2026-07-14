import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import type { BabyMilestoneEntry } from './milestones';
import {
  DEFAULT_MILESTONE_LOCALE,
  formatBabyAgeAtMilestone,
  formatMilestoneDate,
  getMilestoneLocaleTag,
  type MilestoneLocale,
  translateMilestoneText,
} from './milestoneTranslations';

type MilestonePhotobookPdfOptions = {
  entries: BabyMilestoneEntry[];
  babyName?: string | null;
  birthDate?: string | null;
  locale?: MilestoneLocale;
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
  locale = DEFAULT_MILESTONE_LOCALE,
}: MilestonePhotobookPdfOptions & { imageDataUris: Record<string, string | null> }) => {
  const t = (key: string, params?: Record<string, string | number>) =>
    translateMilestoneText(locale, key, params);
  const formatDate = (value: string) => formatMilestoneDate(value, locale);
  const sortedEntries = [...entries].sort((left, right) =>
    left.event_date.localeCompare(right.event_date)
  );
  const displayName = babyName?.trim() || t('pdf.defaultBabyName');
  const firstDate = sortedEntries[0]?.event_date;
  const lastDate = sortedEntries.at(-1)?.event_date;
  const dateRange = firstDate
    ? firstDate === lastDate
      ? formatDate(firstDate)
      : t('pdf.dateRange', {
          from: formatDate(firstDate),
          to: formatDate(lastDate ?? firstDate),
        })
    : '';
  const coverEntry = sortedEntries.find((entry) => Boolean(imageDataUris[entry.id]));
  const coverImageDataUri = coverEntry ? imageDataUris[coverEntry.id] : null;

  const layoutSequence = ['classic', 'split-left', 'banner', 'split-right', 'headline'] as const;

  type PhotobookPage =
    | { kind: 'single'; layout: (typeof layoutSequence)[number]; entry: BabyMilestoneEntry }
    | { kind: 'duo'; entries: [BabyMilestoneEntry, BabyMilestoneEntry] };

  const pages: PhotobookPage[] = [];
  let singleLayoutIndex = 0;
  for (let entryIndex = 0; entryIndex < sortedEntries.length; ) {
    const entry = sortedEntries[entryIndex];
    const nextEntry = sortedEntries[entryIndex + 1];
    const wantsDuo = pages.length % 3 === 2;
    if (wantsDuo && nextEntry && imageDataUris[entry.id] && imageDataUris[nextEntry.id]) {
      pages.push({ kind: 'duo', entries: [entry, nextEntry] });
      entryIndex += 2;
    } else {
      pages.push({
        kind: 'single',
        layout: layoutSequence[singleLayoutIndex % layoutSequence.length],
        entry,
      });
      singleLayoutIndex += 1;
      entryIndex += 1;
    }
  }

  const buildDuoEntryHtml = (entry: BabyMilestoneEntry, position: 'first' | 'second') => {
    const babyAge = formatBabyAgeAtMilestone(birthDate, entry.event_date, locale);
    const notes = entry.notes?.trim();
    return `
      <div class="duo-row duo-row-${position}">
        <div class="duo-photo">
          <div class="photo-frame"><img src="${imageDataUris[entry.id]}" alt="${escapeHtml(entry.title)}" /></div>
        </div>
        <div class="duo-caption">
          <div class="eyebrow">${escapeHtml(t('pdf.memory'))}</div>
          <h2 class="duo-title">${escapeHtml(entry.title)}</h2>
          <div class="duo-date">${escapeHtml(formatDate(entry.event_date))}</div>
          ${babyAge ? `<div class="age-pill">${escapeHtml(babyAge)}</div>` : ''}
          ${notes ? `<div class="duo-notes">${escapeHtml(notes)}</div>` : ''}
        </div>
      </div>
    `;
  };

  const milestonePages = pages
    .map((page, index) => {
      const pageNumberHtml = `
        <footer class="page-footer">
          <span class="page-number">${escapeHtml(t('card.page', { number: String(index + 1).padStart(2, '0') }))}</span>
        </footer>
      `;

      if (page.kind === 'duo') {
        return `
          <section class="page milestone-page layout-duo">
            <div class="album-binding"></div>
            <div class="decoration decoration-top"></div>
            <div class="decoration decoration-bottom"></div>
            <div class="duo-heading">
              <div class="eyebrow">${escapeHtml(t('pdf.memoriesBy', { name: displayName.toUpperCase() }))}</div>
            </div>
            ${buildDuoEntryHtml(page.entries[0], 'first')}
            <div class="duo-divider"><span></span><b>&#10022;</b><span></span></div>
            ${buildDuoEntryHtml(page.entries[1], 'second')}
            ${pageNumberHtml}
          </section>
        `;
      }

      const entry = page.entry;
      const imageDataUri = imageDataUris[entry.id];
      const babyAge = formatBabyAgeAtMilestone(birthDate, entry.event_date, locale);
      const notes = entry.notes?.trim();
      const layout = page.layout;
      const isSplit = layout === 'split-left' || layout === 'split-right';
      const [mediumTitleAt, smallTitleAt] = isSplit ? [20, 34] : [30, 48];
      const titleClass = entry.title.length > smallTitleAt
        ? 'title-small'
        : entry.title.length > mediumTitleAt
          ? 'title-medium'
          : '';
      const longNoteClass = notes && notes.length > 240 ? 'has-long-note' : '';
      const noteClass = notes && notes.length > 340 ? 'notes notes-compact' : 'notes';

      const headerHtml = `
        <header class="milestone-header">
          <div class="eyebrow">${escapeHtml(t('pdf.memoryBy', { name: displayName.toUpperCase() }))}</div>
          <h1 class="milestone-title ${titleClass}">${escapeHtml(entry.title)}</h1>
          <div class="title-flourish"><span></span><b>&#10022;</b><span></span></div>
        </header>
      `;

      const photoHtml = `
        <div class="photo-stage">
          ${imageDataUri
            ? `<div class="photo-frame"><img src="${imageDataUri}" alt="${escapeHtml(entry.title)}" /></div>`
            : `<div class="photo-placeholder"><div class="placeholder-star">&#10022;</div><div>${escapeHtml(t('card.specialMoment'))}</div></div>`}
        </div>
      `;

      const captionHtml = `
        <div class="caption-card">
          <div class="caption-date-row">
            <div class="date">${escapeHtml(formatDate(entry.event_date))}</div>
            ${babyAge ? `<div class="age-pill">${escapeHtml(babyAge)}</div>` : ''}
          </div>
          ${notes ? `<div class="${noteClass}">${escapeHtml(notes)}</div>` : '<div class="caption-line"></div>'}
        </div>
      `;

      const memoryLinesHtml = (lineCount: number) => `
        <div class="memory-lines">
          <div class="memory-lines-heading"><span>${escapeHtml(t('pdf.thoughts'))}</span><b>&#10022;</b></div>
          ${'<div class="writing-line"></div>'.repeat(lineCount)}
        </div>
      `;

      let bodyHtml: string;
      switch (layout) {
        case 'split-left':
          bodyHtml = `
            <div class="split-columns">
              <div class="split-photo">${photoHtml}</div>
              <div class="split-text">${headerHtml}${captionHtml}${memoryLinesHtml(5)}</div>
            </div>
          `;
          break;
        case 'split-right':
          bodyHtml = `
            <div class="split-columns">
              <div class="split-text">${headerHtml}${captionHtml}${memoryLinesHtml(5)}</div>
              <div class="split-photo">${photoHtml}</div>
            </div>
          `;
          break;
        case 'banner':
          bodyHtml = `${photoHtml}${headerHtml}${captionHtml}${memoryLinesHtml(2)}`;
          break;
        case 'headline':
          bodyHtml = `${headerHtml}${captionHtml}${memoryLinesHtml(2)}${photoHtml}`;
          break;
        default:
          bodyHtml = `${headerHtml}${photoHtml}${captionHtml}${memoryLinesHtml(3)}`;
          break;
      }

      return `
        <section class="page milestone-page layout-${layout} ${longNoteClass}">
          <div class="album-binding"></div>
          <div class="decoration decoration-top"></div>
          <div class="decoration decoration-bottom"></div>
          ${bodyHtml}
          ${pageNumberHtml}
        </section>
      `;
    })
    .join('');

  const html = `<!DOCTYPE html>
    <html lang="${getMilestoneLocaleTag(locale)}">
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
            height: 136mm;
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
            max-width: 148mm;
            max-height: 115mm;
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
            padding: 28mm 18mm 15mm 23mm;
          }
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
            max-height: 131mm;
            object-fit: contain;
          }
          .has-long-note .photo-frame img { max-height: 108mm; }
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

          /* Layout: split (Foto links/rechts, Text daneben) */
          .split-columns {
            position: relative;
            z-index: 1;
            flex: 1 1 auto;
            min-height: 0;
            display: flex;
            align-items: stretch;
            gap: 7mm;
          }
          .split-photo {
            flex: 1.35;
            min-width: 0;
            display: flex;
          }
          .split-photo .photo-stage { flex: 1; padding: 2mm 0; }
          .split-photo .photo-frame, .layout-banner .photo-frame { max-height: none; }
          .split-photo .photo-frame img { max-width: 89mm; max-height: 178mm; }
          .split-photo .photo-placeholder { height: 100%; max-height: 170mm; font-size: 10.5pt; }
          .split-text {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 6mm;
          }
          .split-text .milestone-title { font-size: 23pt; }
          .split-text .milestone-title.title-medium { font-size: 20pt; }
          .split-text .milestone-title.title-small { font-size: 17pt; }
          .split-text .caption-date-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 2.5mm;
          }
          .split-text .date { font-size: 14pt; }
          .split-text .age-pill { text-align: left; }
          .split-text .memory-lines { margin-top: 2mm; padding: 0; }

          .layout-split-left {
            background: linear-gradient(150deg, #fcf8fb 0%, #f3e8f2 56%, #f7e9df 100%);
          }
          .layout-split-left .decoration-top {
            right: auto;
            left: -42mm;
            top: -44mm;
            background: #efd9dd;
          }
          .layout-split-left .decoration-bottom {
            left: auto;
            right: -27mm;
            bottom: -38mm;
            background: #dfd7eb;
          }
          .layout-split-left .photo-frame { transform: rotate(-1deg); }
          .layout-split-left .photo-frame::before {
            left: 30%;
            transform: translateX(-50%) rotate(-5deg);
            background: rgba(216, 193, 211, 0.78);
          }
          .layout-split-left .caption-card { border-left-color: #cbb5cf; }
          .layout-split-left .age-pill { background: #ecdfee; }

          .layout-split-right {
            background: linear-gradient(140deg, #fffaf7 0%, #eee7f2 57%, #f6e5df 100%);
          }
          .layout-split-right .decoration-top {
            width: 62mm;
            height: 62mm;
            right: -24mm;
            top: -25mm;
            border-radius: 14mm;
            transform: rotate(14deg);
            background: #dfd5e9;
          }
          .layout-split-right .decoration-bottom {
            width: 58mm;
            height: 58mm;
            left: -24mm;
            bottom: -28mm;
            border-radius: 17mm;
            transform: rotate(-12deg);
            background: #edced0;
          }
          .layout-split-right .split-text { text-align: right; }
          .layout-split-right .title-flourish { margin-left: auto; }
          .layout-split-right .split-text .caption-date-row { align-items: flex-end; }
          .layout-split-right .caption-card {
            border-left: 0;
            border-right: 2.5mm solid #bda9ca;
            border-radius: 4mm 0 0 4mm;
            background: rgba(250, 247, 252, 0.90);
          }
          .layout-split-right .caption-line { margin-left: auto; }
          .layout-split-right .photo-frame {
            transform: rotate(0.9deg);
            padding: 5mm;
            border: 1px solid rgba(111, 83, 103, 0.18);
            border-radius: 5mm;
            background: #fdfafd;
            box-shadow: 0 3mm 9mm rgba(70, 45, 58, 0.15);
          }
          .layout-split-right .photo-frame::before { display: none; }
          .layout-split-right .photo-frame img { border-radius: 2.5mm; }
          .layout-split-right .age-pill { background: #e9e0ee; }
          .layout-split-right .writing-line { border-bottom-style: dotted; }

          /* Layout: banner (Foto oben, Text unten) */
          .layout-banner {
            background: linear-gradient(145deg, #fffaf2 0%, #f5e7d4 62%, #edddce 100%);
            padding-top: 22mm;
          }
          .layout-banner .decoration-top {
            width: 70mm;
            height: 58mm;
            right: -28mm;
            top: -25mm;
            border-radius: 0 0 0 58mm;
            background: #e7cfc2;
          }
          .layout-banner .decoration-bottom {
            width: 82mm;
            height: 82mm;
            left: -49mm;
            bottom: -44mm;
            background: #e9d6b9;
          }
          .layout-banner .photo-stage { padding: 0 0 8mm; }
          .layout-banner .photo-frame {
            transform: rotate(0.8deg);
            box-shadow: 2mm 3mm 8mm rgba(70, 45, 34, 0.15);
          }
          .layout-banner .photo-frame img { max-height: 141mm; }
          .layout-banner.has-long-note .photo-frame img { max-height: 115mm; }
          .layout-banner .photo-frame::before {
            left: 74%;
            transform: translateX(-50%) rotate(4deg);
            background: rgba(225, 198, 159, 0.78);
          }
          .layout-banner .milestone-header { text-align: center; }
          .layout-banner .title-flourish { margin-left: auto; margin-right: auto; }
          .layout-banner .caption-card {
            margin: 5mm 6mm 0;
            border-left: 0;
            border-top: 2mm solid #d8bb96;
            text-align: center;
          }
          .layout-banner .caption-date-row { justify-content: center; flex-wrap: wrap; }
          .layout-banner .caption-line { margin-left: auto; margin-right: auto; }
          .layout-banner .age-pill { background: #efe1c9; }
          .layout-banner .writing-line { border-bottom-style: dashed; }

          /* Layout: headline (Text oben, Foto unten) */
          .layout-headline {
            background: linear-gradient(160deg, #fdf9f3 0%, #f1e9e0 52%, #e9e4ef 100%);
          }
          .layout-headline .decoration-top {
            width: 92mm;
            height: 92mm;
            right: -44mm;
            top: -48mm;
            background: #e3dcec;
          }
          .layout-headline .decoration-bottom {
            width: 60mm;
            height: 60mm;
            left: -26mm;
            bottom: -30mm;
            background: #ead3c4;
          }
          .layout-headline .milestone-title { font-size: 33pt; }
          .layout-headline .milestone-title.title-medium { font-size: 27pt; }
          .layout-headline .milestone-title.title-small { font-size: 22pt; }
          .layout-headline .caption-card {
            margin-top: 6mm;
            border-left-color: #b9a8c9;
            background: rgba(252, 250, 253, 0.85);
          }
          .layout-headline .memory-lines { margin-top: 6mm; }
          .layout-headline .photo-stage { padding: 7mm 0 2mm; }
          .layout-headline .photo-frame { transform: rotate(-0.7deg); }
          .layout-headline .photo-frame::before { background: rgba(206, 194, 222, 0.78); }
          .layout-headline .photo-frame img { max-height: 127mm; }
          .layout-headline.has-long-note .photo-frame img { max-height: 102mm; }

          /* Layout: duo (zwei Erinnerungen auf einer Seite) */
          .layout-duo {
            background: linear-gradient(155deg, #fdfaf4 0%, #f2ebdd 50%, #e8ecdf 100%);
            padding-top: 20mm;
          }
          .layout-duo .decoration-top {
            width: 74mm;
            height: 74mm;
            right: -33mm;
            top: -35mm;
            background: #dfe6d4;
          }
          .layout-duo .decoration-bottom {
            width: 64mm;
            height: 64mm;
            left: -29mm;
            bottom: -31mm;
            background: #ecdcc8;
          }
          .duo-heading {
            position: relative;
            z-index: 1;
            flex: 0 0 auto;
            padding-bottom: 4mm;
            text-align: center;
          }
          .duo-row {
            position: relative;
            z-index: 1;
            flex: 1 1 0;
            min-height: 0;
            display: flex;
            align-items: center;
            gap: 8mm;
          }
          .duo-row-second { flex-direction: row-reverse; }
          .duo-photo {
            flex: 1.25;
            min-width: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .duo-row-first .duo-photo .photo-frame { transform: rotate(-1.3deg); }
          .duo-row-second .duo-photo .photo-frame { transform: rotate(1.1deg); }
          .duo-row-second .duo-photo .photo-frame::before { background: rgba(203, 214, 183, 0.82); }
          .duo-photo .photo-frame img { max-width: 88mm; max-height: 100mm; }
          .duo-caption {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2.5mm;
          }
          .duo-row-second .duo-caption { align-items: flex-end; text-align: right; }
          .duo-caption .age-pill { align-self: flex-start; }
          .duo-row-second .duo-caption .age-pill { align-self: flex-end; }
          .duo-title {
            margin: 0;
            overflow-wrap: anywhere;
            hyphens: auto;
            font: 700 17pt/1.15 Georgia, "Times New Roman", serif;
            letter-spacing: -0.2pt;
          }
          .duo-date { font: 700 11pt/1.3 Georgia, "Times New Roman", serif; color: #6d5346; }
          .duo-notes {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 5;
            overflow: hidden;
            overflow-wrap: anywhere;
            hyphens: auto;
            font-size: 9.5pt;
            line-height: 1.4;
            color: #765d52;
          }
          .duo-divider {
            position: relative;
            z-index: 1;
            flex: 0 0 auto;
            margin: 3mm 10mm;
            display: flex;
            align-items: center;
            gap: 3mm;
            color: #a2926c;
          }
          .duo-divider span { flex: 1; height: 1px; background: #d7cbb2; }
          .duo-divider b { font-size: 9pt; font-weight: 400; }
        </style>
      </head>
      <body>
        <section class="page cover">
          <div class="album-binding"></div>
          <div class="decoration decoration-top"></div>
          <div class="decoration decoration-bottom"></div>
          <div class="cover-heading">
            <div class="cover-kicker">${escapeHtml(t('pdf.coverKicker'))}</div>
            <h1 class="cover-title">${t('pdf.coverTitle')}</h1>
            <div class="cover-subtitle">${escapeHtml(t('pdf.coverSubtitle', { name: displayName }))}</div>
          </div>
          <div class="cover-photo-wrap">
            ${coverImageDataUri
              ? `<div class="cover-photo-mark cover-photo-filled"><div class="cover-tape"></div><img src="${coverImageDataUri}" alt="${escapeHtml(coverEntry?.title)}" /><div class="cover-photo-caption">${escapeHtml(t('pdf.ourPhotobook'))}</div></div>`
              : `<div class="cover-photo-mark cover-photo-empty"><div class="cover-monogram">${escapeHtml(displayName.slice(0, 1).toUpperCase())}</div><div class="cover-photo-caption">${escapeHtml(t('pdf.ourStory'))}</div></div>`}
          </div>
          <div class="cover-meta">
            <div>
              <div class="cover-count-pill">${escapeHtml(t(`pdf.memoryCount.${sortedEntries.length === 1 ? 'one' : 'other'}`, { count: sortedEntries.length }))}</div>
              ${dateRange ? `<div class="cover-range">${escapeHtml(dateRange)}</div>` : ''}
            </div>
            <div class="brand">${escapeHtml(t('card.brand'))}</div>
          </div>
        </section>
        ${milestonePages}
      </body>
    </html>`;

  return { html, pageCount: pages.length + 1 };
};

export const generateMilestonePhotobookPdf = async ({
  entries,
  babyName,
  birthDate,
  locale = DEFAULT_MILESTONE_LOCALE,
}: MilestonePhotobookPdfOptions): Promise<MilestonePhotobookPdfResult> => {
  const t = (key: string, params?: Record<string, string | number>) =>
    translateMilestoneText(locale, key, params);
  if (entries.length === 0) {
    throw new Error(t('pdf.emptyError'));
  }

  const cacheRoot = FileSystem.cacheDirectory;
  if (!cacheRoot) throw new Error(t('pdf.cacheError'));

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
        warnings.push(t('pdf.photoWarning', { title: entry.title }));
      }
    }

    const { html, pageCount } = buildMilestonePhotobookHtml({
      entries,
      babyName,
      birthDate,
      imageDataUris,
      locale,
    });
    const generatedPdf = await Print.printToFileAsync({
      html,
      width: 595,
      height: 842,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    const fileName = `LottiBaby-${safeFilePart(t('pdf.fileLabel'))}-${safeFilePart(
      babyName || t('pdf.defaultFileName'),
    )}-${Date.now()}.pdf`;
    const finalUri = `${cacheRoot}${fileName}`;
    await FileSystem.copyAsync({ from: generatedPdf.uri, to: finalUri });

    return {
      uri: finalUri,
      pageCount,
      warnings,
    };
  } finally {
    await FileSystem.deleteAsync(imageDirectory, { idempotent: true }).catch(() => undefined);
  }
};
