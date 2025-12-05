import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { supabase } from './supabase';

type TableExportConfig = {
  key: string;
  table: string;
  userColumn?: string;
  single?: boolean;
  orderBy?: { column: string; ascending?: boolean };
  queryBuilder?: (userId: string) => ReturnType<typeof supabase.from>;
};

export type UserDataExportResult = {
  success: boolean;
  fileUri?: string;
  summary?: Record<string, number>;
  bytesWritten?: number;
  warnings?: string[];
  error?: string;
  shared?: boolean;
};

const EXPORT_TABLES: TableExportConfig[] = [
  { key: 'profile', table: 'profiles', userColumn: 'id', single: true },
  { key: 'settings', table: 'user_settings' },
  { key: 'baby_info', table: 'baby_info', single: true },
  { key: 'baby_diary', table: 'baby_diary', orderBy: { column: 'entry_date', ascending: true } },
  { key: 'baby_daily', table: 'baby_daily', orderBy: { column: 'entry_date', ascending: true } },
  { key: 'baby_care_entries', table: 'baby_care_entries', orderBy: { column: 'start_time', ascending: true } },
  { key: 'weight_entries', table: 'weight_entries', orderBy: { column: 'date', ascending: true } },
  {
    key: 'sleep_entries',
    table: 'sleep_entries',
    orderBy: { column: 'start_time', ascending: true },
    queryBuilder: (userId: string) =>
      supabase
        .from('sleep_entries')
        .select('*')
        .or(`user_id.eq.${userId},partner_id.eq.${userId},shared_with_user_id.eq.${userId}`)
  },
  { key: 'contractions', table: 'contractions', orderBy: { column: 'start_time', ascending: true } },
  { key: 'doctor_questions', table: 'doctor_questions', orderBy: { column: 'created_at', ascending: true } },
  { key: 'hospital_checklist', table: 'hospital_checklist', orderBy: { column: 'created_at', ascending: true } },
  { key: 'baby_milestone_progress', table: 'baby_milestone_progress' },
  { key: 'baby_current_phase', table: 'baby_current_phase', single: true },
  { key: 'baby_recipes', table: 'baby_recipes', orderBy: { column: 'created_at', ascending: true } },
  {
    key: 'account_links',
    table: 'account_links',
    queryBuilder: (userId: string) =>
      supabase.from('account_links').select('*').or(`creator_id.eq.${userId},invited_id.eq.${userId}`)
  },
];

const buildQuery = (config: TableExportConfig, userId: string) => {
  if (config.queryBuilder) {
    return config.queryBuilder(userId);
  }

  return supabase
    .from(config.table)
    .select('*')
    .eq(config.userColumn ?? 'user_id', userId);
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const exportUserData = async (format: 'pdf' | 'json' = 'pdf'): Promise<UserDataExportResult> => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    const userId = userData.user.id;
    const exportData: Record<string, any> = {};
    const summary: Record<string, number> = {};
    const warnings: string[] = [];

    for (const config of EXPORT_TABLES) {
      try {
        let query: any = buildQuery(config, userId);

        // Sortierung nur anwenden, wenn der Query-Builder dies unterstützt
        if (config.orderBy && query?.order) {
          query = query.order(config.orderBy.column, { ascending: config.orderBy.ascending ?? true });
        }

        if (config.single) {
          const { data, error } = await query.maybeSingle();
          if (error && error.code !== 'PGRST116') {
            warnings.push(`${config.table}: ${error.message}`);
            exportData[config.key] = [];
            summary[config.key] = 0;
            continue;
          }

          const rowArray = data ? [data] : [];
          exportData[config.key] = rowArray;
          summary[config.key] = rowArray.length;
        } else {
          const { data, error } = await query;
          if (error) {
            warnings.push(`${config.table}: ${error.message}`);
            exportData[config.key] = [];
            summary[config.key] = 0;
            continue;
          }

          exportData[config.key] = data ?? [];
          summary[config.key] = data?.length ?? 0;
        }
      } catch (err) {
        warnings.push(`${config.table}: ${(err as Error)?.message ?? 'Unbekannter Fehler'}`);
        exportData[config.key] = [];
        summary[config.key] = 0;
      }
    }

    const payload = {
      generated_at: new Date().toISOString(),
      user: {
        id: userId,
        email: userData.user.email ?? null,
        phone: userData.user.phone ?? null,
      },
      summary,
      data: exportData,
      warnings,
    };

    const json = JSON.stringify(payload, null, 2);

    if (format === 'json') {
      const baseDir =
        FileSystem.documentDirectory ||
        FileSystem.cacheDirectory ||
        'file:///tmp/';
      if (!FileSystem.documentDirectory && !FileSystem.cacheDirectory) {
        warnings.push('Kein App-Verzeichnis gefunden, nutze temporären Pfad /tmp.');
      }
      const normalizedBaseDir = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
      const fileName = `lottibaby-data-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const fileUri = `${normalizedBaseDir}${fileName}`;

      let info;
      try {
        const encoding = (FileSystem as any).EncodingType?.UTF8 ?? 'utf8';
        await FileSystem.writeAsStringAsync(fileUri, json, { encoding });
        info = await FileSystem.getInfoAsync(fileUri);
      } catch (writeErr) {
        return {
          success: false,
          error: `Exportdatei konnte nicht geschrieben werden: ${(writeErr as Error)?.message ?? 'Unbekannter Fehler'}`,
          warnings,
        };
      }

      let shared = false;
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'LottiBaby Daten exportieren',
          });
          shared = true;
        }
      } catch (shareError) {
        warnings.push(`Teilen fehlgeschlagen: ${(shareError as Error)?.message ?? 'Unbekannter Fehler'}`);
      }

      return {
        success: true,
        fileUri,
        summary,
        warnings,
        bytesWritten: typeof info?.size === 'number' ? info.size : json.length,
        shared,
      };
    }

    // PDF-Export
    const escapedJson = escapeHtml(json);
    const summaryRows = Object.entries(summary)
      .map(([key, value]) => `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${key}</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">${value}</td></tr>`)
      .join('');
    const warningsBlock = warnings.length
      ? `<div style="margin-top:12px;padding:8px 10px;border:1px solid #f5c2c7;background:#f8d7da;color:#842029;">
           <strong>Hinweise:</strong>
           <ul style="margin:6px 0 0 16px;padding:0;">
             ${warnings.slice(0, 5).map(w => `<li>${escapeHtml(w)}</li>`).join('')}
           </ul>
         </div>`
      : '';
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: -apple-system, "Segoe UI", sans-serif; padding: 18px; color: #2c2c2c; }
            h1 { font-size: 22px; margin: 0 0 12px; }
            h2 { font-size: 16px; margin: 18px 0 8px; }
            table { border-collapse: collapse; width: 100%; font-size: 13px; }
            pre { background: #f6f8fa; padding: 12px; border-radius: 8px; white-space: pre-wrap; word-break: break-word; font-size: 11px; }
          </style>
        </head>
        <body>
          <h1>LottiBaby Datenexport</h1>
          <div style="font-size:13px; margin-bottom: 10px;">
            Generiert: ${new Date().toLocaleString()}<br/>
            Benutzer: ${escapeHtml(userId)}
          </div>
          <h2>Zusammenfassung</h2>
          <table>${summaryRows}</table>
          ${warningsBlock}
          <h2>Rohdaten (JSON)</h2>
          <pre>${escapedJson}</pre>
        </body>
      </html>
    `;

    let pdfUri = '';
    let info;
    let shared = false;
    try {
      const pdf = await Print.printToFileAsync({ html });
      pdfUri = pdf.uri;
      info = await FileSystem.getInfoAsync(pdfUri);
    } catch (writeErr) {
      return {
        success: false,
        error: `PDF konnte nicht erstellt werden: ${(writeErr as Error)?.message ?? 'Unbekannter Fehler'}`,
        warnings,
      };
    }

    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'LottiBaby Daten exportieren',
          UTI: 'com.adobe.pdf',
        });
        shared = true;
      }
    } catch (shareErr) {
      warnings.push(`Teilen fehlgeschlagen: ${(shareErr as Error)?.message ?? 'Unbekannter Fehler'}`);
    }

    return {
      success: true,
      fileUri: pdfUri,
      summary,
      warnings,
      bytesWritten: typeof info?.size === 'number' ? info.size : undefined,
      shared,
    };
  } catch (error) {
    return { success: false, error: (error as Error)?.message ?? 'Unbekannter Fehler' };
  }
};
