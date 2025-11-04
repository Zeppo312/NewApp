import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';

const RECIPE_BUCKET = 'recipe-images';

export interface RecipeRecord {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  min_months: number;
  ingredients: string[];
  allergens: string[];
  instructions: string;
  tip: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export type RecipeInsert = {
  title: string;
  description?: string | null;
  min_months: number;
  ingredients: string[];
  allergens?: string[];
  instructions: string;
  tip?: string | null;
};

type RecipeCreateResult = {
  data: RecipeRecord | null;
  error: PostgrestError | Error | null;
};

const sanitizeIngredients = (items: string[]): string[] => {
  return items
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const sanitizeAllergens = (items: string[] | undefined): string[] => {
  if (!items) return [];
  const allowed = new Set(['milk', 'gluten', 'egg', 'nuts', 'fish']);
  return items
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0 && allowed.has(item));
};

const stripBase64Prefix = (value: string) => {
  if (!value.includes('base64,')) return value;
  return value.split('base64,')[1];
};

const base64ToUint8Array = (base64Data: string): Uint8Array => {
  const data = stripBase64Prefix(base64Data);

  const decode =
    typeof atob === 'function'
      ? atob
      : typeof (globalThis as any).atob === 'function'
        ? (globalThis as any).atob
        : null;

  if (!decode) {
    throw new Error('Base64 decoding is not supported in this environment.');
  }

  const binary = decode(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return array;
};

const uploadRecipeImage = async (imageBase64: string, userId: string) => {
  try {
    const filename = `recipes/${userId}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}.jpg`;
    const payload = base64ToUint8Array(imageBase64);

    const { data, error } = await supabase.storage
      .from(RECIPE_BUCKET)
      .upload(filename, payload, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Failed to upload recipe image:', error);
      return { publicUrl: null, error };
    }

    const { data: urlData } = supabase.storage
      .from(RECIPE_BUCKET)
      .getPublicUrl(filename);

    return { publicUrl: urlData.publicUrl, error: null };
  } catch (error) {
    console.error('Unexpected error while uploading recipe image:', error);
    return { publicUrl: null, error: error as Error };
  }
};

export const fetchRecipes = async (): Promise<{
  data: RecipeRecord[];
  error: PostgrestError | null;
}> => {
  const { data, error } = await supabase
    .from('baby_recipes')
    .select('*')
    .order('min_months', { ascending: true })
    .order('created_at', { ascending: true });

  return {
    data: data ?? [],
    error,
  };
};

export const createRecipe = async (
  payload: RecipeInsert,
  imageBase64?: string
): Promise<RecipeCreateResult> => {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      return { data: null, error: authError };
    }
    const userId = authData.user?.id;
    if (!userId) {
      return { data: null, error: new Error('Benutzer ist nicht angemeldet.') };
    }

    const normalizedIngredients = sanitizeIngredients(payload.ingredients);
    if (normalizedIngredients.length === 0) {
      return {
        data: null,
        error: new Error('Bitte mindestens eine Zutat hinzufügen.'),
      };
    }
    const normalizedAllergens = sanitizeAllergens(payload.allergens);

    let imageUrl: string | null = null;
    if (imageBase64 && imageBase64.length > 0) {
      const { publicUrl, error: uploadError } = await uploadRecipeImage(
        imageBase64,
        userId
      );
      if (uploadError) {
        return {
          data: null,
          error: uploadError,
        };
      }
      imageUrl = publicUrl;
    }

    const insertPayload = {
      user_id: userId,
      title: payload.title.trim(),
      description: payload.description?.trim() ?? null,
      min_months: payload.min_months,
      ingredients: normalizedIngredients,
      allergens: normalizedAllergens,
      instructions: payload.instructions.trim(),
      tip: payload.tip?.trim() ?? null,
      image_url: imageUrl,
    };

    const { data, error } = await supabase
      .from('baby_recipes')
      .insert(insertPayload)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('Failed to create recipe:', error);
    return { data: null, error: error as Error };
  }
};

export const refreshRecipes = async () => {
  return fetchRecipes();
};
