import { supabase } from '@/lib/supabase';

export type AllergenId = 'milk' | 'gluten' | 'egg' | 'nuts' | 'fish';

export type RecipeRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  title: string;
  description: string | null;
  min_months: number;
  ingredients: string[];
  allergens: AllergenId[];
  instructions: string;
  image_url: string | null;
};

export type CreateRecipePayload = {
  title: string;
  description: string;
  minMonths: number;
  ingredients: string[];
  allergens: AllergenId[];
  instructions: string;
  imageUrl?: string | null;
};

export const fetchRecipes = async (): Promise<RecipeRecord[]> => {
  const { data, error } = await supabase
    .from('recipes')
    .select(
      `id, created_at, updated_at, created_by, title, description, min_months, ingredients, allergens, instructions, image_url`
    )
    .order('min_months', { ascending: true })
    .order('title', { ascending: true });

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  return data.map((item) => ({
    ...item,
    description: item.description ?? '',
    ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
    allergens: Array.isArray(item.allergens) ? (item.allergens as AllergenId[]) : [],
    image_url: item.image_url ?? null,
  }));
};

export const createRecipe = async (payload: CreateRecipePayload): Promise<RecipeRecord> => {
  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      title: payload.title,
      description: payload.description,
      min_months: payload.minMonths,
      ingredients: payload.ingredients,
      allergens: payload.allergens,
      instructions: payload.instructions,
      image_url: payload.imageUrl ?? null,
      created_by: userData?.user?.id ?? null,
    })
    .select(
      `id, created_at, updated_at, created_by, title, description, min_months, ingredients, allergens, instructions, image_url`
    )
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    description: data.description ?? '',
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    allergens: Array.isArray(data.allergens) ? (data.allergens as AllergenId[]) : [],
    image_url: data.image_url ?? null,
  };
};

export const uploadRecipeImage = async (uri: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  const extensionMatch = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(uri);
  const extension = extensionMatch ? extensionMatch[1] : 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const storagePath = `uploads/${fileName}`;

  const { error } = await supabase.storage
    .from('recipe-images')
    .upload(storagePath, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: blob.type || `image/${extension}`,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('recipe-images').getPublicUrl(storagePath);

  return publicUrl;
};
