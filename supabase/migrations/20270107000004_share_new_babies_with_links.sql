-- Auto-share new babies with accepted account links.

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_share_new_baby ON public.baby_info;
CREATE TRIGGER trg_share_new_baby
  AFTER INSERT ON public.baby_info
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_baby_share();
