import { getCachedUser, supabase } from './supabase';
import { compressImage } from './imageCompression';

export type MilestoneCategory =
  | 'motorik'
  | 'ernaehrung'
  | 'sprache'
  | 'zahn'
  | 'schlaf'
  | 'sonstiges';

export type BabyMilestoneEntry = {
  id: string;
  user_id: string;
  baby_id: string;
  title: string;
  category: MilestoneCategory;
  event_date: string; // YYYY-MM-DD
  image_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const MILESTONE_IMAGE_BUCKET = 'community-images';

const CATEGORY_SET = new Set<MilestoneCategory>([
  'motorik',
  'ernaehrung',
  'sprache',
  'zahn',
  'schlaf',
  'sonstiges',
]);

export const MILESTONE_CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  motorik: 'Motorik',
  ernaehrung: 'Ernährung',
  sprache: 'Sprache',
  zahn: 'Zähne',
  schlaf: 'Schlaf',
  sonstiges: 'Sonstiges',
};

const isMilestoneCategory = (value: string): value is MilestoneCategory =>
  CATEGORY_SET.has(value as MilestoneCategory);

const normalizeTitle = (title: string) => {
  const normalized = title.trim();
  if (!normalized) {
    throw new Error('Bitte gib einen Titel ein.');
  }
  return normalized;
};

const normalizeDateOnly = (date: string) => {
  const normalized = date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('Ungültiges Datum. Erwartet wird YYYY-MM-DD.');
  }
  return normalized;
};

const normalizeNotes = (notes?: string | null): string | null => {
  if (!notes) return null;
  const normalized = notes.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeEntry = (entry: any): BabyMilestoneEntry => {
  if (!isMilestoneCategory(entry.category)) {
    throw new Error(`Ungültige Kategorie: ${entry.category}`);
  }

  return {
    id: entry.id,
    user_id: entry.user_id,
    baby_id: entry.baby_id,
    title: entry.title,
    category: entry.category,
    event_date: entry.event_date,
    image_url: entry.image_url ?? null,
    notes: entry.notes ?? null,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
};

const getStoragePathFromPublicUrl = (publicUrl: string, bucket: string): string | null => {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  const path = publicUrl.slice(index + marker.length).split('?')[0];
  return path.length > 0 ? decodeURIComponent(path) : null;
};

const deleteMilestoneImageFromStorage = async (publicUrl: string | null | undefined) => {
  if (!publicUrl) return;
  const storagePath = getStoragePathFromPublicUrl(publicUrl, MILESTONE_IMAGE_BUCKET);
  if (!storagePath) return;

  const { error } = await supabase.storage.from(MILESTONE_IMAGE_BUCKET).remove([storagePath]);
  if (error) {
    console.warn('Failed to remove milestone image from storage:', error.message);
  }
};

const uploadMilestoneImage = async (
  imageInput: { uri?: string | null; base64?: string | null },
  userId: string,
  babyId: string
) => {
  const { bytes } = await compressImage(
    { uri: imageInput.uri ?? undefined, base64: imageInput.base64 ?? undefined },
    { maxDimension: 1280, quality: 0.72 }
  );

  const filePath = `milestones/${babyId}/${userId}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(MILESTONE_IMAGE_BUCKET)
    .upload(filePath, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: urlData } = supabase.storage.from(MILESTONE_IMAGE_BUCKET).getPublicUrl(filePath);
  return urlData.publicUrl;
};

export const getMilestoneEntries = async (babyId: string, category?: MilestoneCategory) => {
  try {
    if (!babyId) {
      return { data: [] as BabyMilestoneEntry[], error: null };
    }

    const { data: userData, error: userError } = await getCachedUser();
    if (userError) return { data: null, error: userError };
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    let query = supabase
      .from('baby_milestone_entries')
      .select('*')
      .eq('baby_id', babyId)
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) return { data: null, error };

    const normalized = (data ?? []).map(normalizeEntry);
    return { data: normalized, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const createMilestoneEntry = async (entry: {
  baby_id: string;
  title: string;
  category: MilestoneCategory;
  event_date: string;
  image_uri?: string | null;
  image_base64?: string | null;
  notes?: string | null;
}) => {
  try {
    const { data: userData, error: userError } = await getCachedUser();
    if (userError) return { data: null, error: userError };
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    if (!entry.baby_id) {
      return { data: null, error: new Error('Kein Baby ausgewählt') };
    }

    if (!isMilestoneCategory(entry.category)) {
      return { data: null, error: new Error('Ungültige Kategorie') };
    }

    let imageUrl: string | null = null;
    if (entry.image_uri || entry.image_base64) {
      imageUrl = await uploadMilestoneImage(
        { uri: entry.image_uri, base64: entry.image_base64 },
        userData.user.id,
        entry.baby_id
      );
    }

    const now = new Date().toISOString();
    const payload = {
      user_id: userData.user.id,
      baby_id: entry.baby_id,
      title: normalizeTitle(entry.title),
      category: entry.category,
      event_date: normalizeDateOnly(entry.event_date),
      image_url: imageUrl,
      notes: normalizeNotes(entry.notes),
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('baby_milestone_entries')
      .insert(payload)
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: normalizeEntry(data), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const updateMilestoneEntry = async (
  id: string,
  updates: Partial<Pick<BabyMilestoneEntry, 'title' | 'category' | 'event_date' | 'notes'>> & {
    image_uri?: string | null;
    image_base64?: string | null;
  }
) => {
  try {
    if (!id) {
      return { data: null, error: new Error('Fehlende Eintrags-ID') };
    }

    const { data: userData, error: userError } = await getCachedUser();
    if (userError) return { data: null, error: userError };
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data: existing, error: existingError } = await supabase
      .from('baby_milestone_entries')
      .select('baby_id, image_url')
      .eq('id', id)
      .single();

    if (existingError || !existing?.baby_id) {
      return { data: null, error: existingError ?? new Error('Eintrag nicht gefunden') };
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) {
      payload.title = normalizeTitle(updates.title);
    }

    if (updates.category !== undefined) {
      if (!isMilestoneCategory(updates.category)) {
        return { data: null, error: new Error('Ungültige Kategorie') };
      }
      payload.category = updates.category;
    }

    if (updates.event_date !== undefined) {
      payload.event_date = normalizeDateOnly(updates.event_date);
    }

    if (updates.notes !== undefined) {
      payload.notes = normalizeNotes(updates.notes);
    }

    if (updates.image_uri !== undefined || updates.image_base64 !== undefined) {
      const hasImage = Boolean(updates.image_uri || updates.image_base64);
      if (hasImage) {
        const nextImageUrl = await uploadMilestoneImage(
          { uri: updates.image_uri, base64: updates.image_base64 },
          userData.user.id,
          existing.baby_id
        );
        payload.image_url = nextImageUrl;
        if (existing.image_url && existing.image_url !== nextImageUrl) {
          await deleteMilestoneImageFromStorage(existing.image_url);
        }
      } else {
        payload.image_url = null;
        if (existing.image_url) {
          await deleteMilestoneImageFromStorage(existing.image_url);
        }
      }
    }

    const { data, error } = await supabase
      .from('baby_milestone_entries')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: normalizeEntry(data), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const deleteMilestoneEntry = async (id: string) => {
  try {
    if (!id) return { error: new Error('Fehlende Eintrags-ID') };

    const { data: existing } = await supabase
      .from('baby_milestone_entries')
      .select('image_url')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from('baby_milestone_entries')
      .delete()
      .eq('id', id);

    if (!error && existing?.image_url) {
      await deleteMilestoneImageFromStorage(existing.image_url);
    }

    return { error };
  } catch (err) {
    return { error: err };
  }
};
