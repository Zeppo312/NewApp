import { supabase } from './supabase';
import { getCachedUser } from './supabase';

export async function getPartnerId(): Promise<string | null> {
  const { data: userData, error: userErr } = await getCachedUser();
  if (userErr || !userData.user) return null;

  const myId = userData.user.id;

  const { data, error } = await supabase
    .from('account_links')
    .select('creator_id, invited_id')
    .eq('status', 'accepted')
    .eq('relationship_type', 'partner')
    .or(`creator_id.eq.${myId},invited_id.eq.${myId}`)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return data.creator_id === myId ? data.invited_id : data.creator_id;
}

