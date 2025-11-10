import { supabase } from '../supabase';

export interface LottiRecommendation {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  product_link: string;
  discount_code: string | null;
  order_index: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface CreateRecommendationInput {
  title: string;
  description: string;
  image_url?: string;
  product_link: string;
  discount_code?: string;
  order_index?: number;
}

/**
 * Prüft, ob der aktuelle User ein Admin ist
 */
export async function isUserAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }

    return profile?.is_admin === true;
  } catch (error) {
    console.error('Error in isUserAdmin:', error);
    return false;
  }
}

/**
 * Holt alle Empfehlungen sortiert nach order_index
 */
export async function getRecommendations(): Promise<LottiRecommendation[]> {
  try {
    const { data, error } = await supabase
      .from('lotti_recommendations')
      .select('*')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    throw error;
  }
}

/**
 * Erstellt eine neue Empfehlung (nur für Admins)
 */
export async function createRecommendation(
  input: CreateRecommendationInput
): Promise<LottiRecommendation> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nicht authentifiziert');

    const { data, error } = await supabase
      .from('lotti_recommendations')
      .insert({
        title: input.title,
        description: input.description,
        image_url: input.image_url || null,
        product_link: input.product_link,
        discount_code: input.discount_code || null,
        order_index: input.order_index || 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating recommendation:', error);
    throw error;
  }
}

/**
 * Aktualisiert eine Empfehlung (nur für Admins)
 */
export async function updateRecommendation(
  id: string,
  updates: Partial<CreateRecommendationInput>
): Promise<LottiRecommendation> {
  try {
    const { data, error } = await supabase
      .from('lotti_recommendations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating recommendation:', error);
    throw error;
  }
}

/**
 * Löscht eine Empfehlung (nur für Admins)
 */
export async function deleteRecommendation(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('lotti_recommendations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting recommendation:', error);
    throw error;
  }
}

/**
 * Aktualisiert die Reihenfolge mehrerer Empfehlungen
 */
export async function updateRecommendationsOrder(
  items: Array<{ id: string; order_index: number }>
): Promise<void> {
  try {
    const updates = items.map(item =>
      supabase
        .from('lotti_recommendations')
        .update({ order_index: item.order_index })
        .eq('id', item.id)
    );

    await Promise.all(updates);
  } catch (error) {
    console.error('Error updating recommendations order:', error);
    throw error;
  }
}

/**
 * Lädt ein Bild zu Supabase Storage hoch und gibt die öffentliche URL zurück
 */
export async function uploadRecommendationImage(
  uri: string,
  fileName: string
): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nicht authentifiziert');

    // Fetch the image as blob
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // Generate unique filename
    const fileExt = fileName.split('.').pop();
    const uniqueFileName = `${user.id}/${Date.now()}.${fileExt}`;
    const filePath = `recommendation-images/${uniqueFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('public-images')
      .upload(filePath, blob, {
        contentType: blob.type,
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('public-images')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

