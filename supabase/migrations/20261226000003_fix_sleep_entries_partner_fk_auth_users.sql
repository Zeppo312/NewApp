-- Align partner_id FK with auth.users and clean invalid partner references.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sleep_entries'
      AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE public.sleep_entries
      ALTER COLUMN partner_id DROP NOT NULL;

    UPDATE public.sleep_entries se
    SET partner_id = NULL
    WHERE partner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM auth.users u
        WHERE u.id = se.partner_id
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sleep_entries'
      AND constraint_name = 'fk_partner'
  ) THEN
    ALTER TABLE public.sleep_entries DROP CONSTRAINT fk_partner;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sleep_entries'
      AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE public.sleep_entries
      ADD CONSTRAINT fk_partner
      FOREIGN KEY (partner_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END
$$;
