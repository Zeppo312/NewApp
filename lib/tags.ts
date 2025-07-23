import { supabase } from './supabase';

// Typdefinitionen
export interface Tag {
  id: string;
  name: string;
  category: 'trimester' | 'baby_age';
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Alle Tags abrufen
export const getTags = async () => {
  try {
    const { data, error } = await supabase
      .from('community_tags')
      .select('*')
      .order('category')
      .order('display_order');

    if (error) {
      console.error('Error fetching tags:', error);
      return { data: null, error };
    }

    // Tags nach Kategorie gruppieren
    const groupedTags = {
      trimester: data.filter(tag => tag.category === 'trimester'),
      baby_age: data.filter(tag => tag.category === 'baby_age')
    };

    return { data: groupedTags, error: null };
  } catch (err) {
    console.error('Failed to get tags:', err);
    return { data: null, error: err };
  }
};

// Tags für einen Post abrufen
export const getTagsForPost = async (postId: string) => {
  try {
    const { data, error } = await supabase
      .from('community_post_tags')
      .select(`
        tag_id,
        community_tags (
          id,
          name,
          category,
          display_order
        )
      `)
      .eq('post_id', postId);

    if (error) {
      console.error('Error fetching tags for post:', error);
      return { data: null, error };
    }

    // Formatiere die Daten
    const tags = data.map(item => item.community_tags);

    return { data: tags, error: null };
  } catch (err) {
    console.error('Failed to get tags for post:', err);
    return { data: null, error: err };
  }
};

// Tags zu einem Post hinzufügen
export const addTagsToPost = async (postId: string, tagIds: string[]) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Prüfen, ob der Post dem Benutzer gehört
    const { data: post, error: postError } = await supabase
      .from('community_posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    if (postError) {
      console.error('Error fetching post:', postError);
      return { data: null, error: postError };
    }

    if (post.user_id !== userData.user.id) {
      return { data: null, error: new Error('Keine Berechtigung') };
    }

    // Bestehende Tags für diesen Post entfernen
    const { error: deleteError } = await supabase
      .from('community_post_tags')
      .delete()
      .eq('post_id', postId);

    if (deleteError) {
      console.error('Error deleting existing tags:', deleteError);
      return { data: null, error: deleteError };
    }

    // Keine Tags hinzufügen, wenn die Liste leer ist
    if (tagIds.length === 0) {
      return { data: [], error: null };
    }

    // Neue Tags hinzufügen
    const tagsToInsert = tagIds.map(tagId => ({
      post_id: postId,
      tag_id: tagId,
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('community_post_tags')
      .insert(tagsToInsert)
      .select();

    if (error) {
      console.error('Error adding tags to post:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to add tags to post:', err);
    return { data: null, error: err };
  }
};

// Posts nach Tags filtern
export const getPostsByTags = async (tagIds: string[]) => {
  try {
    const { data, error } = await supabase
      .rpc('get_posts_with_tags', { tag_ids: tagIds });

    if (error) {
      console.error('Error fetching posts by tags:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to get posts by tags:', err);
    return { data: null, error: err };
  }
};
