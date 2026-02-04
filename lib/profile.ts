import { supabase } from './supabase';
import { getCachedUser } from './supabase';
import { compressImage } from './imageCompression';

const AVATAR_BUCKET = 'community-images';

export const uploadProfileAvatar = async (base64Data: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData?.user) {
      return { url: null, error: new Error('Nicht angemeldet') };
    }

    // Komprimieren & resizen (Avatar max ~640px Kantenlänge, moderate Qualität)
    const { bytes } = await compressImage(
      { base64: base64Data },
      { maxDimension: 640, quality: 0.72 }
    );

    const fileName = `avatar_${userData.user.id}_${Date.now()}.jpg`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, bytes, {
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
    const { data: userData } = await getCachedUser();
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

type DeleteUserDataOptions = {
  deleteAuth?: boolean;
  avatarUrl?: string | null;
};

const parseDeleteUserResponse = (data: any) => {
  if (!data || typeof data !== 'object') {
    return { error: null };
  }

  if (data.success === false) {
    const message = typeof data.error === 'string' && data.error.trim()
      ? data.error
      : 'Unbekannter Fehler beim Löschen';
    return { error: new Error(message) };
  }

  return { error: null };
};

export const deleteUserData = async (options: DeleteUserDataOptions = {}) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData?.user) {
      return { error: new Error('Nicht angemeldet') };
    }

    if (options?.avatarUrl) {
      const { error } = await deleteProfileAvatar(options.avatarUrl);
      if (error) {
        return { error };
      }
    }
    const { data, error } = await supabase.rpc('delete_user_data', {
      delete_auth: options.deleteAuth ?? false,
    });
    if (error) {
      return { error };
    }

    return parseDeleteUserResponse(data);
  } catch (error) {
    console.error('Error deleting user data:', error);
    return { error: error as Error };
  }
};

export const deleteUserAccount = async (options?: { avatarUrl?: string | null }) =>
  deleteUserData({ ...options, deleteAuth: true });
