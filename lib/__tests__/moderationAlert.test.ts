import { sendModerationFallbackEmail } from '../../supabase/functions/_shared/moderationAlert';

const alert = {
  reportId: 'report-123',
  targetType: 'group_message',
  reason: 'harassment',
  source: 'user_report',
  createdAt: '2026-08-20T10:00:00.000Z',
  openCount: 4,
};

describe('moderation fallback email', () => {
  it('does not call the provider unless every production secret is configured', async () => {
    const fetcher = jest.fn();

    await expect(
      sendModerationFallbackEmail({ apiKey: 'key' }, alert, fetcher),
    ).resolves.toEqual({
      status: 'not_configured',
      missing: ['MODERATION_ALERT_EMAIL_FROM', 'MODERATION_ALERT_EMAIL_TO'],
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends a data-minimized alert to all configured recipients', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));

    await expect(
      sendModerationFallbackEmail(
        {
          apiKey: 'resend-key',
          from: 'Lotti Baby <moderation@lottibaby.de>',
          to: 'admin-a@lottibaby.de, admin-b@lottibaby.de',
        },
        alert,
        fetcher,
      ),
    ).resolves.toEqual({ status: 'sent' });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(request.headers.Authorization).toBe('Bearer resend-key');

    const body = JSON.parse(request.body);
    expect(body.to).toEqual(['admin-a@lottibaby.de', 'admin-b@lottibaby.de']);
    expect(body.text).toContain('Meldungs-ID: report-123');
    expect(body.text).toContain('com.lottibaby.app://moderation-admin');
    expect(body.text).not.toContain('target_snapshot');
  });

  it('reports provider rejection without losing control of the result', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response('{"message":"sender not verified"}', { status: 422 }),
    );

    await expect(
      sendModerationFallbackEmail(
        {
          apiKey: 'resend-key',
          from: 'moderation@lottibaby.de',
          to: 'admin@lottibaby.de',
        },
        alert,
        fetcher,
      ),
    ).resolves.toMatchObject({ status: 'failed' });
  });
});
