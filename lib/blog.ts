import { supabase } from './supabase';

type ProfileRecord = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};

export interface BlogPost {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  summary?: string | null;
  content: string;
  cover_image_url?: string | null;
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export type CreateBlogPostPayload = {
  authorId: string;
  title: string;
  content: string;
  summary?: string | null;
  coverImageUrl?: string | null;
  isPublished?: boolean;
};

export type UpdateBlogPostPayload = {
  title: string;
  content: string;
  summary?: string | null;
  coverImageUrl?: string | null;
  isPublished?: boolean;
  publishedAt?: string | null;
};

const BLOG_BUCKET = 'community-images';

const buildDisplayName = (profile?: ProfileRecord | null) => {
  if (!profile) {
    return 'Lotti Baby Team';
  }

  const firstName = profile.first_name?.trim();
  const lastName = profile.last_name?.trim();
  const username = profile.username?.trim();

  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ');
  }

  if (username) {
    return username;
  }

  return 'Lotti Baby Team';
};

const summarize = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 240) {
    return normalized;
  }
  return `${normalized.slice(0, 240).trim()}…`;
};

export const getBlogPosts = async () => {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, title, summary, content, cover_image_url, is_published, published_at, created_at, updated_at, author_id')
    .order('published_at', { ascending: false });

  if (error) {
    return { data: [], error };
  }

  if (!data || data.length === 0) {
    return { data: [], error: null };
  }

  const authorIds = Array.from(new Set(data.map((post) => post.author_id).filter(Boolean)));
  let authorMap: Record<string, string> = {};

  if (authorIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, username')
      .in('id', authorIds);

    if (profileError) {
      console.warn('Unable to load blog author profiles:', profileError);
    } else if (profiles) {
      authorMap = profiles.reduce<Record<string, string>>((acc, profile) => {
        if (profile?.id) {
          acc[profile.id] = buildDisplayName(profile);
        }
        return acc;
      }, {});
    }
  }

  const posts: BlogPost[] = data.map((post) => ({
    id: post.id,
    authorId: post.author_id,
    authorName: authorMap[post.author_id] ?? 'Lotti Baby Team',
    title: post.title,
    summary: post.summary ?? summarize(post.content),
    content: post.content,
    cover_image_url: post.cover_image_url,
    is_published: post.is_published,
    published_at: post.published_at,
    created_at: post.created_at,
    updated_at: post.updated_at,
  }));

  return { data: posts, error: null };
};

export const createBlogPost = async (payload: CreateBlogPostPayload) => {
  const trimmedTitle = payload.title.trim();
  const trimmedContent = payload.content.trim();

  if (!trimmedTitle || !trimmedContent) {
    return { data: null, error: new Error('Titel und Inhalt sind erforderlich') };
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      author_id: payload.authorId,
      title: trimmedTitle,
      content: trimmedContent,
      summary: payload.summary?.trim() || summarize(trimmedContent),
      cover_image_url: payload.coverImageUrl?.trim() || null,
      is_published: payload.isPublished ?? true,
    })
    .select('*')
    .single();

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
};

export const updateBlogPost = async (id: string, payload: UpdateBlogPostPayload) => {
  const trimmedTitle = payload.title.trim();
  const trimmedContent = payload.content.trim();

  if (!trimmedTitle || !trimmedContent) {
    return { data: null, error: new Error('Titel und Inhalt sind erforderlich') };
  }

  const updates: Record<string, string | boolean | null> = {
    title: trimmedTitle,
    content: trimmedContent,
    summary: payload.summary?.trim() || summarize(trimmedContent),
    cover_image_url: payload.coverImageUrl?.trim() ?? null,
    updated_at: new Date().toISOString(),
  };

  if (payload.isPublished !== undefined) {
    updates.is_published = payload.isPublished;
    if (payload.isPublished) {
      updates.published_at = payload.publishedAt ?? new Date().toISOString();
    } else {
      // Wenn auf Entwurf gestellt wird, published_at nicht auf NULL setzen (Spalte ist NOT NULL)
      delete updates.published_at;
    }
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
};

export const uploadBlogCover = async (uri: string, userId: string) => {
  try {
    const extMatch = uri.split('.').pop();
    const ext = extMatch?.split('?')[0]?.toLowerCase() || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const response = await fetch(uri);

    if (!response.ok) {
      return { data: null, error: new Error(`Bild konnte nicht geladen werden (${response.status})`) };
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer); // RN fetch liefert kein .blob, deshalb ArrayBuffer nutzen
    const fileName = `blog_${userId}_${Date.now()}.${ext}`;
    const filePath = `blog-covers/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BLOG_BUCKET)
      .upload(filePath, fileBuffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      return { data: null, error: uploadError };
    }

    const { data: publicUrlData } = supabase.storage.from(BLOG_BUCKET).getPublicUrl(filePath);
    return { data: publicUrlData.publicUrl, error: null };
  } catch (error) {
    console.error('uploadBlogCover failed:', error);
    return { data: null, error: error as Error };
  }
};

export const deleteBlogPost = async (id: string) => {
  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  return { error };
};
