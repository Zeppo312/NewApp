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
