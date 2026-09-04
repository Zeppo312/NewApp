import { getCachedUser, supabase } from '@/lib/supabase';
import { normalizeCustomActivityEmoji } from '@/lib/customActivityEmoji';

export type CustomTrackingMode = 'event' | 'quantity' | 'duration';

export type CustomActivityType = {
  id: string;
  baby_id: string;
  created_by: string | null;
  name: string;
  emoji: string;
  color: string;
  tracking_mode: CustomTrackingMode;
  unit: string | null;
  default_quantity: number | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomActivityTypeDraft = Pick<
  CustomActivityType,
  'name' | 'emoji' | 'color' | 'tracking_mode' | 'unit' | 'default_quantity'
>;

const normalizeDraft = (draft: CustomActivityTypeDraft): CustomActivityTypeDraft => {
  const isQuantity = draft.tracking_mode === 'quantity';
  return {
    name: draft.name.trim(),
    emoji: normalizeCustomActivityEmoji(draft.emoji, draft.name),
    color: draft.color,
    tracking_mode: draft.tracking_mode,
    unit: isQuantity ? draft.unit?.trim() || null : null,
    default_quantity: isQuantity ? draft.default_quantity : null,
  };
};

export const getCustomActivityTypes = async (
  babyId: string,
  options: { includeArchived?: boolean } = {},
) => {
  let query = supabase
    .from('custom_activity_types')
    .select('*')
    .eq('baby_id', babyId)
    .order('created_at', { ascending: true });

  if (!options.includeArchived) {
    query = query.eq('is_archived', false);
  }

  return query.returns<CustomActivityType[]>();
};

export const createCustomActivityType = async (
  babyId: string,
  draft: CustomActivityTypeDraft,
) => {
  const { data: userData, error: userError } = await getCachedUser();
  if (userError || !userData.user) {
    return { data: null, error: userError ?? new Error('Nicht angemeldet') };
  }

  return supabase
    .from('custom_activity_types')
    .insert({
      baby_id: babyId,
      created_by: userData.user.id,
      ...normalizeDraft(draft),
    })
    .select()
    .single<CustomActivityType>();
};

export const updateCustomActivityType = async (
  id: string,
  babyId: string,
  draft: CustomActivityTypeDraft,
) =>
  supabase
    .from('custom_activity_types')
    .update(normalizeDraft(draft))
    .eq('id', id)
    .eq('baby_id', babyId)
    .select()
    .single<CustomActivityType>();

export const archiveCustomActivityType = async (id: string, babyId: string) =>
  supabase
    .from('custom_activity_types')
    .update({ is_archived: true })
    .eq('id', id)
    .eq('baby_id', babyId)
    .select()
    .single<CustomActivityType>();
