import { supabase } from './supabase';

const AVATAR_BUCKET = 'community-images';

export const uploadProfileAvatar = async (base64Data: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return { url: null, error: new Error('Nicht angemeldet') };
    }

    const cleaned = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;
    const binary = atob(cleaned);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      buffer[i] = binary.charCodeAt(i);
    }

    const fileName = `avatar_${userData.user.id}_${Date.now()}.jpg`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return { url: null, error: uploadError };
    }

    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
    return { url: urlData.publicUrl, error: null };
  } catch (error) {
    console.error('Error uploading profile avatar:', error);
    return { url: null, error };
  }
};

const extractAvatarStoragePath = (avatarUrl: string) => {
  try {
    const url = new URL(avatarUrl);
    const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch (err) {
    console.warn('Could not parse avatar url for removal:', err);
    return null;
  }
};

export const deleteProfileAvatar = async (avatarUrl: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return { error: new Error('Nicht angemeldet') };
    }

    const storagePath = extractAvatarStoragePath(avatarUrl);
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([storagePath]);
      if (storageError) {
        console.warn('Failed to delete avatar from storage:', storageError.message);
      }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userData.user.id);

    if (updateError) {
      return { error: updateError };
    }

    return { error: null };
  } catch (error) {
    console.error('Error deleting profile avatar:', error);
    return { error: error as Error };
  }
};

type TableDeletion = {
  table: string;
  column: string;
};

export const deleteUserProfile = async (options?: { avatarUrl?: string | null }) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return { error: new Error('Nicht angemeldet') };
    }
    const userId = userData.user.id;

    if (options?.avatarUrl) {
      const { error } = await deleteProfileAvatar(options.avatarUrl);
      if (error) {
        return { error };
      }
    }

    const targets: TableDeletion[] = [
      { table: 'baby_info', column: 'user_id' },
      { table: 'baby_diary', column: 'user_id' },
      { table: 'user_settings', column: 'user_id' },
      { table: 'profiles', column: 'id' },
    ];

    for (const target of targets) {
      const { error } = await supabase
        .from(target.table)
        .delete()
        .eq(target.column, userId);
      if (error && error.code !== 'PGRST116') {
        return { error };
      }
    }

    return { error: null };
  } catch (error) {
    console.error('Error deleting user profile:', error);
    return { error: error as Error };
  }
};
