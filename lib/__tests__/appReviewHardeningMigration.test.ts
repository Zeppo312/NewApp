import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const migration = readFileSync(
  join(root, 'supabase/migrations/20270820000000_app_review_hardening.sql'),
  'utf8',
);
const functionConfig = readFileSync(join(root, 'supabase/config.toml'), 'utf8');

const functionBody = (name: string, nextSection: string): string => {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  const end = migration.indexOf(nextSection, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
};

describe('App Review hardening migration contracts', () => {
  it('keeps terms evidence append-only and inaccessible to direct client writes', () => {
    expect(migration).toContain('PRIMARY KEY (user_id, terms_version)');
    expect(migration).toContain(
      'REVOKE ALL ON TABLE public.terms_consents FROM PUBLIC, anon, authenticated',
    );
    expect(migration).toContain('GRANT SELECT ON TABLE public.terms_consents TO authenticated');
    expect(migration).toContain('ON CONFLICT (user_id, terms_version) DO NOTHING');
  });

  it('deletes content and suspends the account before resolving the report', () => {
    const body = functionBody(
      'moderation_remove_content_and_suspend_user',
      '-- A standalone suspension',
    );
    const deletePosition = body.indexOf('DELETE FROM public.community_posts');
    const suspendPosition = body.indexOf('UPDATE public.profiles');
    const resolvePosition = body.indexOf("SET status = 'resolved'");

    expect(body).toContain('FOR UPDATE');
    expect(deletePosition).toBeGreaterThanOrEqual(0);
    expect(suspendPosition).toBeGreaterThan(deletePosition);
    expect(resolvePosition).toBeGreaterThan(suspendPosition);
  });

  it('excludes blocked senders from group previews and both unread calculations', () => {
    const summaries = functionBody(
      'get_my_group_chat_summaries',
      'CREATE OR REPLACE FUNCTION public.get_total_group_chat_unread_count',
    );
    const totalUnread = functionBody(
      'get_total_group_chat_unread_count',
      '-- --------------------------------------------------------------------------\n-- 4.',
    );

    expect(summaries.match(/NOT public\.is_blocked_pair/g)).toHaveLength(2);
    expect(totalUnread).toContain(
      'NOT public.is_blocked_pair(auth.uid(), message_record.sender_id)',
    );
  });

  it('uses a required shared webhook secret with gateway JWT verification disabled', () => {
    expect(functionConfig).toMatch(
      /\[functions\.moderation-report-notify\]\s+verify_jwt\s*=\s*false/,
    );
    expect(migration).toContain("WHERE secret_record.name = 'moderation_webhook_secret'");
    expect(migration).toContain("'Authorization', 'Bearer ' || webhook_secret");
  });
});
