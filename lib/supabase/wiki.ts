import { supabase } from '@/lib/supabase';

// Typdefinitionen
export interface WikiCategory {
  id: string;
  name: string;
  icon: string;
}

export interface WikiArticle {
  id: string;
  title: string;
  category_id: string;
  teaser: string;
  reading_time: string;
  content?: {
    coreStatements: string[];
    sections: {
      title: string;
      content: string;
    }[];
  };
  isFavorite?: boolean; // Wird clientseitig hinzugefügt
}

export interface WikiArticleInput {
  title: string;
  category_id: string;
  teaser: string;
  reading_time: string;
  content?: WikiArticle['content'];
}

// Funktion zum Abrufen aller Kategorien
export const getWikiCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('wiki_categories')
      .select('*')
      .order('name');

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching wiki categories:', error);
    return { data: null, error };
  }
};

// Funktion zum Abrufen aller Artikel
export const getWikiArticles = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    // Abrufen aller Artikel
    const { data: articles, error } = await supabase
      .from('wiki_articles')
      .select(`
        id,
        title,
        category_id,
        teaser,
        reading_time,
        content,
        wiki_categories(name)
      `)
      .order('title');

    if (error) throw error;

    // Wenn der Benutzer angemeldet ist, prüfen wir, welche Artikel als Favoriten markiert sind
    if (userId) {
      const { data: favorites, error: favoritesError } = await supabase
        .from('wiki_favorites')
        .select('article_id')
        .eq('user_id', userId);

      if (favoritesError) throw favoritesError;

      // Favoriten-Status zu den Artikeln hinzufügen
      const articlesWithFavorites = articles.map(article => ({
        ...article,
        isFavorite: favorites.some(fav => fav.article_id === article.id)
      }));

      return { data: articlesWithFavorites, error: null };
    }

    // Wenn kein Benutzer angemeldet ist, geben wir die Artikel ohne Favoriten-Status zurück
    return { data: articles.map(article => ({ ...article, isFavorite: false })), error: null };
  } catch (error) {
    console.error('Error fetching wiki articles:', error);
    return { data: null, error };
  }
};

// Funktion zum Abrufen eines einzelnen Artikels
export const getWikiArticle = async (articleId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    // Abrufen des Artikels
    const { data: article, error } = await supabase
      .from('wiki_articles')
      .select(`
        id,
        title,
        category_id,
        teaser,
        reading_time,
        content,
        wiki_categories(name)
      `)
      .eq('id', articleId)
      .single();

    if (error) throw error;

    // Wenn der Benutzer angemeldet ist, prüfen wir, ob der Artikel als Favorit markiert ist
    if (userId) {
      const { data: favorite, error: favoriteError } = await supabase
        .from('wiki_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('article_id', articleId)
        .maybeSingle();

      if (favoriteError) throw favoriteError;

      return { 
        data: { 
          ...article, 
          isFavorite: !!favorite 
        }, 
        error: null 
      };
    }

    // Wenn kein Benutzer angemeldet ist, geben wir den Artikel ohne Favoriten-Status zurück
    return { data: { ...article, isFavorite: false }, error: null };
  } catch (error) {
    console.error('Error fetching wiki article:', error);
    return { data: null, error };
  }
};

// Funktion zum Erstellen eines Artikels (Admin)
export const createWikiArticle = async (input: WikiArticleInput) => {
  try {
    const { data, error } = await supabase
      .from('wiki_articles')
      .insert({
        title: input.title,
        category_id: input.category_id,
        teaser: input.teaser,
        reading_time: input.reading_time,
        content: input.content ?? null,
      })
      .select(`
        id,
        title,
        category_id,
        teaser,
        reading_time,
        content,
        wiki_categories(name)
      `)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error creating wiki article:', error);
    return { data: null, error };
  }
};

// Funktion zum Aktualisieren eines Artikels (Admin)
export const updateWikiArticle = async (
  articleId: string,
  updates: Partial<WikiArticleInput>
) => {
  try {
    const { data, error } = await supabase
      .from('wiki_articles')
      .update({
        title: updates.title,
        category_id: updates.category_id,
        teaser: updates.teaser,
        reading_time: updates.reading_time,
        content: updates.content ?? null,
      })
      .eq('id', articleId)
      .select(`
        id,
        title,
        category_id,
        teaser,
        reading_time,
        content,
        wiki_categories(name)
      `)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating wiki article:', error);
    return { data: null, error };
  }
};

// Funktion zum Löschen eines Artikels (Admin)
export const deleteWikiArticle = async (articleId: string) => {
  try {
    const { data, error } = await supabase
      .from('wiki_articles')
      .delete()
      .eq('id', articleId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error deleting wiki article:', error);
    return { data: null, error };
  }
};

// Funktion zum Abrufen von Artikeln nach Kategorie
export const getWikiArticlesByCategory = async (categoryId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    // Abrufen der Artikel nach Kategorie
    const { data: articles, error } = await supabase
      .from('wiki_articles')
      .select(`
        id,
        title,
        category_id,
        teaser,
        reading_time,
        content,
        wiki_categories(name)
      `)
      .eq('category_id', categoryId)
      .order('title');

    if (error) throw error;

    // Wenn der Benutzer angemeldet ist, prüfen wir, welche Artikel als Favoriten markiert sind
    if (userId) {
      const { data: favorites, error: favoritesError } = await supabase
        .from('wiki_favorites')
        .select('article_id')
        .eq('user_id', userId);

      if (favoritesError) throw favoritesError;

      // Favoriten-Status zu den Artikeln hinzufügen
      const articlesWithFavorites = articles.map(article => ({
        ...article,
        isFavorite: favorites.some(fav => fav.article_id === article.id)
      }));

      return { data: articlesWithFavorites, error: null };
    }

    // Wenn kein Benutzer angemeldet ist, geben wir die Artikel ohne Favoriten-Status zurück
    return { data: articles.map(article => ({ ...article, isFavorite: false })), error: null };
  } catch (error) {
    console.error('Error fetching wiki articles by category:', error);
    return { data: null, error };
  }
};

// Funktion zum Abrufen von Favoriten-Artikeln
export const getFavoriteWikiArticles = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      return { data: [], error: new Error('Nicht angemeldet') };
    }

    // Abrufen der Favoriten-Artikel
    const { data: favorites, error } = await supabase
      .from('wiki_favorites')
      .select(`
        article_id,
        wiki_articles(
          id,
          title,
          category_id,
          teaser,
          reading_time,
          content,
          wiki_categories(name)
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    // Umwandeln der Daten in das gewünschte Format
    const articles = favorites.map(fav => ({
      ...fav.wiki_articles,
      isFavorite: true
    }));

    return { data: articles, error: null };
  } catch (error) {
    console.error('Error fetching favorite wiki articles:', error);
    return { data: null, error };
  }
};

// Funktion zum Hinzufügen eines Artikels zu den Favoriten
export const addWikiArticleToFavorites = async (articleId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    const { data, error } = await supabase
      .from('wiki_favorites')
      .insert({
        user_id: userId,
        article_id: articleId
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error adding wiki article to favorites:', error);
    return { data: null, error };
  }
};

// Funktion zum Entfernen eines Artikels aus den Favoriten
export const removeWikiArticleFromFavorites = async (articleId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    const { data, error } = await supabase
      .from('wiki_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('article_id', articleId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error removing wiki article from favorites:', error);
    return { data: null, error };
  }
};

// Funktion zum Suchen von Artikeln
export const searchWikiArticles = async (searchTerm: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    // Suchen nach Artikeln, die den Suchbegriff im Titel oder Teaser enthalten
    const { data: articles, error } = await supabase
      .from('wiki_articles')
      .select(`
        id,
        title,
        category_id,
        teaser,
        reading_time,
        content,
        wiki_categories(name)
      `)
      .or(`title.ilike.%${searchTerm}%,teaser.ilike.%${searchTerm}%`)
      .order('title');

    if (error) throw error;

    // Wenn der Benutzer angemeldet ist, prüfen wir, welche Artikel als Favoriten markiert sind
    if (userId) {
      const { data: favorites, error: favoritesError } = await supabase
        .from('wiki_favorites')
        .select('article_id')
        .eq('user_id', userId);

      if (favoritesError) throw favoritesError;

      // Favoriten-Status zu den Artikeln hinzufügen
      const articlesWithFavorites = articles.map(article => ({
        ...article,
        isFavorite: favorites.some(fav => fav.article_id === article.id)
      }));

      return { data: articlesWithFavorites, error: null };
    }

    // Wenn kein Benutzer angemeldet ist, geben wir die Artikel ohne Favoriten-Status zurück
    return { data: articles.map(article => ({ ...article, isFavorite: false })), error: null };
  } catch (error) {
    console.error('Error searching wiki articles:', error);
    return { data: null, error };
  }
};
