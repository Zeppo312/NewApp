/* eslint-disable import/no-unresolved */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSettingsLocale, localize } from '../_shared/localization.ts';

/**
 * Benachrichtigt alle Moderatoren (profiles.is_admin) über eine neue Meldung.
 * Wird vom Trigger `trigger_send_moderation_report_webhook` aufgerufen und ist
 * die technische Grundlage für die 24-Stunden-Zusage aus App Store Guideline 1.2.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

interface ModerationReportWebhookPayload {
  type: 'INSERT';
  table: 'content_reports';
  record: {
    id: string;
    reporter_id: string | null;
    reported_user_id: string | null;
    target_type: string;
    target_id: string;
    target_snapshot: string | null;
    reason: string;
    details: string | null;
    source: string;
    created_at: string;
  };
}

const TARGET_LABELS: Record<string, { de: string; en: string; es: string }> = {
  post: { de: 'Beitrag', en: 'Post', es: 'Publicación' },
  comment: { de: 'Kommentar', en: 'Comment', es: 'Comentario' },
  nested_comment: { de: 'Antwort', en: 'Reply', es: 'Respuesta' },
  group_post: { de: 'Gruppen-Beitrag', en: 'Group post', es: 'Publicación de grupo' },
  group_comment: { de: 'Gruppen-Kommentar', en: 'Group comment', es: 'Comentario de grupo' },
  group_nested_comment: { de: 'Gruppen-Antwort', en: 'Group reply', es: 'Respuesta de grupo' },
  group_message: { de: 'Gruppen-Nachricht', en: 'Group message', es: 'Mensaje de grupo' },
  direct_message: { de: 'Direktnachricht', en: 'Direct message', es: 'Mensaje directo' },
  profile: { de: 'Profil', en: 'Profile', es: 'Perfil' },
};

serve(async (req: Request) => {
  try {
    // Der Trigger sendet den Secret-Header nur, wenn er in der Datenbank
    // gesetzt ist. Ist in der Function kein Secret konfiguriert, wird die
    // Prüfung übersprungen, damit Meldungen nie stillschweigend verloren gehen.
    const expectedSecret = Deno.env.get('MODERATION_WEBHOOK_SECRET');
    if (expectedSecret) {
      const authorization = req.headers.get('Authorization');
      if (authorization !== `Bearer ${expectedSecret}`) {
        return new Response(JSON.stringify({ message: 'Unauthorized' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 401,
        });
      }
    }

    const payload: ModerationReportWebhookPayload = await req.json();

    if (payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ message: 'Not an INSERT event' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { id: reportId, target_type, reason, target_snapshot, source } = payload.record;

    // Meldung serverseitig verifizieren, damit gefälschte Aufrufe nichts auslösen.
    const { data: report, error: reportError } = await supabase
      .from('content_reports')
      .select('id, target_type, reason, target_snapshot, source, status')
      .eq('id', reportId)
      .maybeSingle();

    if (reportError) {
      console.error('Error verifying moderation report:', reportError);
    }

    if (!report) {
      return new Response(JSON.stringify({ message: 'Report not found' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { data: admins, error: adminError } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true);

    if (adminError) {
      console.error('Error fetching moderators:', adminError);
      throw adminError;
    }

    const adminIds = (admins || []).map((admin: { id: string }) => admin.id);

    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ message: 'No moderators configured' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { count: openCount } = await supabase
      .from('content_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');

    const { data: tokens, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('token, user_id')
      .in('user_id', adminIds);

    if (tokenError) {
      console.error('Error fetching moderator push tokens:', tokenError);
      throw tokenError;
    }

    if (!tokens || tokens.length === 0) {
      console.warn('Moderation report received but no moderator push tokens found', reportId);
      return new Response(JSON.stringify({ message: 'No push tokens for moderators' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { data: adminSettings } = await supabase
      .from('user_settings')
      .select('user_id, resolved_language, language_preference')
      .in('user_id', adminIds);

    const settingsByUser = new Map(
      (adminSettings || []).map((entry: { user_id: string }) => [entry.user_id, entry]),
    );

    const snapshot = (report.target_snapshot ?? target_snapshot ?? '').trim();
    const preview = snapshot.length > 120 ? `${snapshot.slice(0, 117)}...` : snapshot;

    const pushRequests = tokens.map((tokenRecord: { token: string; user_id: string }) => {
      const locale = getSettingsLocale(settingsByUser.get(tokenRecord.user_id));
      const targetLabel = localize(
        locale,
        TARGET_LABELS[report.target_type ?? target_type] ?? {
          de: 'Inhalt',
          en: 'Content',
          es: 'Contenido',
        },
      );
      const isAutoFilter = (report.source ?? source) === 'auto_filter';

      const title = isAutoFilter
        ? localize(locale, {
            de: 'Automatischer Filtertreffer',
            en: 'Automatic filter match',
            es: 'Coincidencia del filtro automático',
          })
        : localize(locale, {
            de: `Neue Meldung: ${targetLabel}`,
            en: `New report: ${targetLabel}`,
            es: `Nueva denuncia: ${targetLabel}`,
          });

      const body = preview
        ? preview
        : localize(locale, {
            de: `Grund: ${report.reason ?? reason}`,
            en: `Reason: ${report.reason ?? reason}`,
            es: `Motivo: ${report.reason ?? reason}`,
          });

      return fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: tokenRecord.token,
          title,
          body,
          sound: 'default',
          priority: 'high',
          badge: typeof openCount === 'number' ? openCount : undefined,
          data: {
            type: 'moderation_report',
            reportId,
            targetType: report.target_type ?? target_type,
          },
        }),
      });
    });

    const results = await Promise.allSettled(pushRequests);
    const failed = results.filter((result) => result.status === 'rejected').length;

    return new Response(
      JSON.stringify({
        message: 'Moderation notifications sent',
        sent: results.length - failed,
        failed,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('moderation-report-notify failed:', error);
    return new Response(JSON.stringify({ message: 'Internal error' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
