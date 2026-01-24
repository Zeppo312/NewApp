-- Extend new-baby sharing to reuse existing baby_members when account_links is empty.

CREATE OR REPLACE FUNCTION public.handle_new_baby_share()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.baby_members (baby_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.baby_members (baby_id, user_id, role)
  SELECT
    NEW.id,
    CASE
      WHEN al.creator_id = NEW.user_id THEN al.invited_id
      ELSE al.creator_id
    END AS partner_id,
    'partner'
  FROM public.account_links al
  WHERE al.status = 'accepted'
    AND (al.creator_id = NEW.user_id OR al.invited_id = NEW.user_id)
    AND (al.creator_id IS NOT NULL AND al.invited_id IS NOT NULL)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.baby_members (baby_id, user_id, role)
  SELECT
    NEW.id,
    bm.user_id,
    COALESCE(bm.role, 'partner')
  FROM public.baby_members bm
  JOIN public.baby_info bi ON bi.id = bm.baby_id
  WHERE bi.user_id = NEW.user_id
    AND bm.user_id <> NEW.user_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
