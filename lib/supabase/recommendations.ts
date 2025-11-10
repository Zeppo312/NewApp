import { supabase } from '@/lib/supabase';

export type LottiRecommendation = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  product_url: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type LottiRecommendationInput = {
  title: string;
  description: string;
  imageUrl?: string;
  productUrl?: string;
};

export const getLottiRecommendations = async () => {
  const { data, error } = await supabase
    .from('lotti_recommendations')
    .select('id, title, description, image_url, product_url, created_at, updated_at')
    .order('created_at', { ascending: true });

  return { data: data as LottiRecommendation[] | null, error };
};

export const addLottiRecommendation = async (input: LottiRecommendationInput) => {
  const payload = {
    title: input.title.trim(),
    description: input.description.trim(),
    image_url: input.imageUrl?.trim() || null,
    product_url: input.productUrl?.trim() || null,
  };

  const { data, error } = await supabase
    .from('lotti_recommendations')
    .insert(payload)
    .select('id, title, description, image_url, product_url, created_at, updated_at')
    .single();

  return { data: data as LottiRecommendation | null, error };
};

export const deleteLottiRecommendation = async (id: string) => {
  const { error } = await supabase
    .from('lotti_recommendations')
    .delete()
    .eq('id', id);

  return { error };
};
