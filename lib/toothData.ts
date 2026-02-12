import { getCachedUser, supabase } from './supabase';

export type ToothPosition =
  | 'upper_right_second_molar'
  | 'upper_right_first_molar'
  | 'upper_right_canine'
  | 'upper_right_lateral_incisor'
  | 'upper_right_central_incisor'
  | 'upper_left_central_incisor'
  | 'upper_left_lateral_incisor'
  | 'upper_left_canine'
  | 'upper_left_first_molar'
  | 'upper_left_second_molar'
  | 'lower_right_second_molar'
  | 'lower_right_first_molar'
  | 'lower_right_canine'
  | 'lower_right_lateral_incisor'
  | 'lower_right_central_incisor'
  | 'lower_left_central_incisor'
  | 'lower_left_lateral_incisor'
  | 'lower_left_canine'
  | 'lower_left_first_molar'
  | 'lower_left_second_molar';

export type ToothSymptom = 'fever' | 'restlessness' | 'teething_pain';

export type ToothEntry = {
  id: string;
  user_id: string;
  baby_id: string;
  tooth_position: ToothPosition;
  eruption_date: string; // YYYY-MM-DD
  notes: string | null;
  symptoms: ToothSymptom[];
  created_at: string;
  updated_at: string;
};

export type BabyToothDef = {
  key: ToothPosition;
  label: string;
  row: 'upper' | 'lower';
  side: 'left' | 'right';
  type: 'incisor' | 'canine' | 'molar';
};

export const BABY_TEETH: BabyToothDef[] = [
  { key: 'upper_right_second_molar', label: 'Oberer 2. Backenzahn rechts', row: 'upper', side: 'right', type: 'molar' },
  { key: 'upper_right_first_molar', label: 'Oberer 1. Backenzahn rechts', row: 'upper', side: 'right', type: 'molar' },
  { key: 'upper_right_canine', label: 'Oberer Eckzahn rechts', row: 'upper', side: 'right', type: 'canine' },
  { key: 'upper_right_lateral_incisor', label: 'Oberer seitl. Schneidezahn rechts', row: 'upper', side: 'right', type: 'incisor' },
  { key: 'upper_right_central_incisor', label: 'Oberer mittl. Schneidezahn rechts', row: 'upper', side: 'right', type: 'incisor' },
  { key: 'upper_left_central_incisor', label: 'Oberer mittl. Schneidezahn links', row: 'upper', side: 'left', type: 'incisor' },
  { key: 'upper_left_lateral_incisor', label: 'Oberer seitl. Schneidezahn links', row: 'upper', side: 'left', type: 'incisor' },
  { key: 'upper_left_canine', label: 'Oberer Eckzahn links', row: 'upper', side: 'left', type: 'canine' },
  { key: 'upper_left_first_molar', label: 'Oberer 1. Backenzahn links', row: 'upper', side: 'left', type: 'molar' },
  { key: 'upper_left_second_molar', label: 'Oberer 2. Backenzahn links', row: 'upper', side: 'left', type: 'molar' },
  { key: 'lower_right_second_molar', label: 'Unterer 2. Backenzahn rechts', row: 'lower', side: 'right', type: 'molar' },
  { key: 'lower_right_first_molar', label: 'Unterer 1. Backenzahn rechts', row: 'lower', side: 'right', type: 'molar' },
  { key: 'lower_right_canine', label: 'Unterer Eckzahn rechts', row: 'lower', side: 'right', type: 'canine' },
  { key: 'lower_right_lateral_incisor', label: 'Unterer seitl. Schneidezahn rechts', row: 'lower', side: 'right', type: 'incisor' },
  { key: 'lower_right_central_incisor', label: 'Unterer mittl. Schneidezahn rechts', row: 'lower', side: 'right', type: 'incisor' },
  { key: 'lower_left_central_incisor', label: 'Unterer mittl. Schneidezahn links', row: 'lower', side: 'left', type: 'incisor' },
  { key: 'lower_left_lateral_incisor', label: 'Unterer seitl. Schneidezahn links', row: 'lower', side: 'left', type: 'incisor' },
  { key: 'lower_left_canine', label: 'Unterer Eckzahn links', row: 'lower', side: 'left', type: 'canine' },
  { key: 'lower_left_first_molar', label: 'Unterer 1. Backenzahn links', row: 'lower', side: 'left', type: 'molar' },
  { key: 'lower_left_second_molar', label: 'Unterer 2. Backenzahn links', row: 'lower', side: 'left', type: 'molar' },
];

export const BABY_TEETH_MAP: Record<ToothPosition, BabyToothDef> = Object.fromEntries(
  BABY_TEETH.map((tooth) => [tooth.key, tooth])
) as Record<ToothPosition, BabyToothDef>;

const TOOTH_POSITION_SET = new Set<ToothPosition>(BABY_TEETH.map((tooth) => tooth.key));
const SYMPTOM_SET = new Set<ToothSymptom>(['fever', 'restlessness', 'teething_pain']);

export const isValidToothPosition = (value: string): value is ToothPosition => TOOTH_POSITION_SET.has(value as ToothPosition);

const normalizeSymptoms = (symptoms?: ToothSymptom[] | string[] | null): ToothSymptom[] => {
  if (!Array.isArray(symptoms)) return [];
  const deduped: ToothSymptom[] = [];
  for (const raw of symptoms) {
    const symptom = raw as ToothSymptom;
    if (SYMPTOM_SET.has(symptom) && !deduped.includes(symptom)) {
      deduped.push(symptom);
    }
  }
  return deduped;
};

const normalizeNotes = (notes?: string | null): string | null => {
  if (!notes) return null;
  const trimmed = notes.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeDateOnly = (date: string) => {
  const normalized = date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('Ungültiges Datum. Erwartet wird YYYY-MM-DD.');
  }
  return normalized;
};

const normalizeEntry = (entry: any): ToothEntry => {
  if (!isValidToothPosition(entry.tooth_position)) {
    throw new Error(`Ungültige Zahnposition: ${entry.tooth_position}`);
  }

  return {
    id: entry.id,
    user_id: entry.user_id,
    baby_id: entry.baby_id,
    tooth_position: entry.tooth_position,
    eruption_date: entry.eruption_date,
    notes: entry.notes ?? null,
    symptoms: normalizeSymptoms(entry.symptoms),
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
};

export const getToothEntries = async (babyId: string) => {
  try {
    if (!babyId) {
      return { data: [] as ToothEntry[], error: null };
    }

    const { data: userData, error: userError } = await getCachedUser();
    if (userError) return { data: null, error: userError };
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('tooth_entries')
      .select('*')
      .eq('baby_id', babyId)
      .order('eruption_date', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) return { data: null, error };

    const normalized = (data ?? []).map(normalizeEntry);
    return { data: normalized, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const saveToothEntry = async (entry: {
  baby_id: string;
  tooth_position: ToothPosition;
  eruption_date: string;
  notes?: string | null;
  symptoms?: ToothSymptom[] | string[] | null;
}) => {
  try {
    const { data: userData, error: userError } = await getCachedUser();
    if (userError) return { data: null, error: userError };
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    if (!entry.baby_id) {
      return { data: null, error: new Error('Kein Baby ausgewählt') };
    }

    if (!isValidToothPosition(entry.tooth_position)) {
      return { data: null, error: new Error('Ungültige Zahnposition') };
    }

    const payload = {
      eruption_date: normalizeDateOnly(entry.eruption_date),
      notes: normalizeNotes(entry.notes),
      symptoms: normalizeSymptoms(entry.symptoms),
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: existingError } = await supabase
      .from('tooth_entries')
      .select('id')
      .eq('baby_id', entry.baby_id)
      .eq('tooth_position', entry.tooth_position)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      return { data: null, error: existingError };
    }

    if (existing?.id) {
      const { data, error } = await supabase
        .from('tooth_entries')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) return { data: null, error };
      return { data: normalizeEntry(data), error: null };
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('tooth_entries')
      .insert({
        user_id: userData.user.id,
        baby_id: entry.baby_id,
        tooth_position: entry.tooth_position,
        ...payload,
        created_at: now,
      })
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: normalizeEntry(data), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const updateToothEntry = async (
  id: string,
  updates: Partial<Pick<ToothEntry, 'eruption_date' | 'notes' | 'symptoms' | 'tooth_position'>>
) => {
  try {
    if (!id) return { data: null, error: new Error('Fehlende Eintrags-ID') };

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.eruption_date !== undefined) {
      payload.eruption_date = normalizeDateOnly(updates.eruption_date);
    }

    if (updates.notes !== undefined) {
      payload.notes = normalizeNotes(updates.notes);
    }

    if (updates.symptoms !== undefined) {
      payload.symptoms = normalizeSymptoms(updates.symptoms);
    }

    if (updates.tooth_position !== undefined) {
      if (!isValidToothPosition(updates.tooth_position)) {
        return { data: null, error: new Error('Ungültige Zahnposition') };
      }
      payload.tooth_position = updates.tooth_position;
    }

    const { data, error } = await supabase
      .from('tooth_entries')
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

export const deleteToothEntry = async (id: string) => {
  try {
    if (!id) return { error: new Error('Fehlende Eintrags-ID') };

    const { error } = await supabase
      .from('tooth_entries')
      .delete()
      .eq('id', id);

    return { error };
  } catch (err) {
    return { error: err };
  }
};
