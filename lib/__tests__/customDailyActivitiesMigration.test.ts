import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const schemaMigration = readFileSync(
  join(root, 'supabase/migrations/20270901000000_add_custom_daily_activities.sql'),
  'utf8',
);
const validationMigration = readFileSync(
  join(root, 'supabase/migrations/20270901000001_validate_custom_daily_activities.sql'),
  'utf8',
);
const indexMigration = readFileSync(
  join(root, 'supabase/migrations/20270901000002_index_custom_daily_activities_concurrently.sql'),
  'utf8',
);

const careConstraints = [
  'baby_care_entries_custom_activity_baby_fkey',
  'baby_care_entries_entry_type_check',
  'baby_care_entries_custom_tracking_mode_check',
  'baby_care_entries_custom_quantity_check',
  'baby_care_entries_custom_snapshot_values_check',
  'baby_care_entries_custom_payload_check',
];

describe('custom daily activity migration contracts', () => {
  it('fails closed when the expected multi-baby schema is missing or partially installed', () => {
    expect(schemaMigration).toContain("to_regclass('public.baby_members')");
    expect(schemaMigration).toContain("to_regprocedure('public.is_baby_member(uuid)')");
    expect(schemaMigration).toContain('unerwartete Teilinstallation erkannt');
    expect(schemaMigration).toContain("SET lock_timeout = '5s'");
  });

  it('keeps existing feeding and diaper entries compatible', () => {
    expect(schemaMigration).toContain("entry_type IN ('feeding', 'diaper', 'custom')");
    expect(schemaMigration).not.toMatch(/DROP\s+COLUMN/i);
    expect(schemaMigration).not.toMatch(/DELETE\s+FROM\s+public\.baby_care_entries/i);
    expect(schemaMigration).not.toMatch(/UPDATE\s+public\.baby_care_entries/i);
  });

  it('protects templates with RLS, explicit API grants, and baby-scoped references', () => {
    expect(schemaMigration).toContain(
      'ALTER TABLE public.custom_activity_types ENABLE ROW LEVEL SECURITY',
    );
    expect(schemaMigration).toContain('TO authenticated');
    expect(schemaMigration).toContain('public.is_baby_member(baby_id)');
    expect(schemaMigration).toContain(
      'REVOKE ALL ON public.custom_activity_types FROM anon',
    );
    expect(schemaMigration).toContain(
      'FOREIGN KEY (custom_activity_type_id, baby_id)',
    );
    expect(schemaMigration).toContain('ON DELETE SET NULL (custom_activity_type_id)');
  });

  it('adds existing-table constraints without scanning, then validates every one', () => {
    for (const constraint of careConstraints) {
      const definition = new RegExp(`ADD CONSTRAINT ${constraint}[\\s\\S]*?NOT VALID`);
      expect(schemaMigration).toMatch(definition);
      expect(validationMigration).toContain(`VALIDATE CONSTRAINT ${constraint}`);
    }
  });

  it('builds the existing-table FK index concurrently in its own migration', () => {
    expect(indexMigration).toContain('CREATE INDEX CONCURRENTLY');
    expect(indexMigration).toContain(
      'ON public.baby_care_entries(custom_activity_type_id, baby_id)',
    );
    expect(indexMigration.match(/CREATE\s+INDEX/gi)).toHaveLength(1);
  });
});
