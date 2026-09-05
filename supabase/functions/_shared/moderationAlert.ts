const RESEND_EMAIL_URL = 'https://api.resend.com/emails';

export type ModerationAlertConfig = {
  apiKey?: string;
  from?: string;
  to?: string;
};

export type ModerationAlert = {
  reportId: string;
  targetType: string;
  reason: string;
  source: string;
  createdAt: string;
  openCount: number | null;
};

export type ModerationAlertResult =
  | { status: 'sent' }
  | { status: 'not_configured'; missing: string[] }
  | { status: 'failed'; error: string };

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

const splitRecipients = (value: string): string[] =>
  value
    .split(',')
    .map((recipient) => recipient.trim())
    .filter(Boolean);

export const sendModerationFallbackEmail = async (
  config: ModerationAlertConfig,
  alert: ModerationAlert,
  fetcher: Fetcher = fetch,
): Promise<ModerationAlertResult> => {
  const missing = [
    !config.apiKey?.trim() ? 'RESEND_API_KEY' : null,
    !config.from?.trim() ? 'MODERATION_ALERT_EMAIL_FROM' : null,
    !config.to?.trim() ? 'MODERATION_ALERT_EMAIL_TO' : null,
  ].filter((entry): entry is string => !!entry);

  if (missing.length > 0) {
    return { status: 'not_configured', missing };
  }

  const recipients = splitRecipients(config.to as string);
  if (recipients.length === 0) {
    return { status: 'not_configured', missing: ['MODERATION_ALERT_EMAIL_TO'] };
  }

  const openCountLine = typeof alert.openCount === 'number'
    ? `Offene Meldungen insgesamt: ${alert.openCount}`
    : 'Offene Meldungen insgesamt: unbekannt';
  const text = [
    'Eine Moderationsmeldung wartet in Lotti Baby auf Bearbeitung.',
    '',
    `Meldungs-ID: ${alert.reportId}`,
    `Inhaltstyp: ${alert.targetType}`,
    `Grund: ${alert.reason}`,
    `Quelle: ${alert.source}`,
    `Erstellt: ${alert.createdAt}`,
    openCountLine,
    '',
    'Bitte innerhalb von 24 Stunden im Moderationsbereich der App prüfen:',
    'com.lottibaby.app://moderation-admin',
  ].join('\n');

  try {
    const response = await fetcher(RESEND_EMAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: recipients,
        subject: '[Lotti Baby] Neue Moderationsmeldung',
        text,
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      return {
        status: 'failed',
        error: `Resend rejected the alert (${response.status})${
          responseBody ? `: ${responseBody.slice(0, 300)}` : ''
        }`,
      };
    }

    return { status: 'sent' };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown email delivery error',
    };
  }
};
