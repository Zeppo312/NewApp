-- Add reply/quote support for direct messages (WhatsApp-style).
-- reply_to_id references another message in the same table.
-- ON DELETE SET NULL keeps the reply intact even if the original is deleted.
-- A trigger enforces that the referenced message belongs to the same
-- conversation (same pair of participants), preventing cross-chat quoting.

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID
  REFERENCES public.direct_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_direct_messages_reply_to_id
  ON public.direct_messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

COMMENT ON COLUMN public.direct_messages.reply_to_id IS
  'References the message this is a reply/quote to. NULL = no quote.';

-- Validate that reply_to_id points to a message in the same conversation.
-- "Same conversation" = the participant pair {sender, receiver} is identical
-- (regardless of direction).
--
-- SECURITY DEFINER so the lookup bypasses RLS and always sees the real row.
-- Without it, RLS could hide the referenced message, causing ref_sender_id
-- to be NULL, which would incorrectly allow cross-chat quoting.
-- search_path is locked to prevent search_path hijacking.
CREATE OR REPLACE FUNCTION public.validate_reply_to_same_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_sender_id  UUID;
  ref_receiver_id UUID;
BEGIN
  -- Nothing to validate when there is no quote
  IF NEW.reply_to_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sender_id, receiver_id
    INTO ref_sender_id, ref_receiver_id
    FROM public.direct_messages
   WHERE id = NEW.reply_to_id;

  -- Referenced message was deleted or doesn't exist – allow gracefully
  -- (the FK with ON DELETE SET NULL handles the cleanup case)
  IF ref_sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- The participant pair must match in either direction
  IF (
    (NEW.sender_id = ref_sender_id   AND NEW.receiver_id = ref_receiver_id) OR
    (NEW.sender_id = ref_receiver_id AND NEW.receiver_id = ref_sender_id)
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'reply_to_id must reference a message in the same conversation '
    '(sender/receiver pair mismatch)'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_reply_to ON public.direct_messages;

CREATE TRIGGER trigger_validate_reply_to
  BEFORE INSERT OR UPDATE OF reply_to_id ON public.direct_messages
  FOR EACH ROW
  WHEN (NEW.reply_to_id IS NOT NULL)
  EXECUTE FUNCTION public.validate_reply_to_same_conversation();

COMMENT ON FUNCTION public.validate_reply_to_same_conversation IS
  'Ensures reply_to_id only references a message from the same conversation.';

COMMENT ON TRIGGER trigger_validate_reply_to ON public.direct_messages IS
  'Prevents cross-chat quoting by validating the reply target participant pair.';
