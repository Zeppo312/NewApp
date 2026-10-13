import { type User } from '@supabase/supabase-js';

import { getCachedUser, supabase } from './supabase';
import { requestAccountDeletion } from './accountDeletion';
import { compressImage } from './imageCompression';
import { getSubscriptionManagementStoreLabel } from './subscriptionManagement';

const AVATAR_BUCKET = 'community-images';
const APPLE_PROVIDER = 'apple';

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

export type AccountDeletionRequirements = {
  hasAppleSignIn: boolean;
};

const hasLinkedProvider = (user: User | null | undefined, provider: string) => {
  if (!user) return false;

  const normalizedProvider = provider.toLowerCase();
  const primaryProvider = String(user.app_metadata?.provider ?? '').toLowerCase();
  const linkedProviders = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers.map((entry) => String(entry).toLowerCase())
    : [];

  if (primaryProvider === normalizedProvider) {
    return true;
  }

  if (linkedProviders.includes(normalizedProvider)) {
    return true;
  }

  return user.identities?.some(
    (identity) => String(identity.provider ?? '').toLowerCase() === normalizedProvider,
  ) ?? false;
};

export const getAccountDeletionRequirements = async () => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData?.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    return {
      data: {
        hasAppleSignIn: hasLinkedProvider(userData.user, APPLE_PROVIDER),
      } satisfies AccountDeletionRequirements,
      error: null,
    };
  } catch (error) {
    console.error('Error loading account deletion requirements:', error);
    return { data: null, error: error as Error };
  }
};

export const buildAccountDeletionWarningMessage = (requirements?: AccountDeletionRequirements | null) => {
  const storeLabel = getSubscriptionManagementStoreLabel();
  const appleText = requirements?.hasAppleSignIn
    ? '\n\nDa dein Konto mit "Mit Apple anmelden" verknüpft ist, wird auch der Widerruf des Apple-Zugriffs im Löschauftrag bearbeitet.'
    : '';

  return `Das Löschen deines Kontos beendet dein Abo im ${storeLabel} nicht automatisch. Falls du ein aktives Store-Abo hast, kann die Abrechnung sonst weiterlaufen. Bitte prüfe oder kündige dein Abo vorher über "Abo verwalten".${appleText}`;
};

// All entry points share the durable server workflow. Media selection and
// Apple/provider handling are server responsibilities, never client URL input.
export const deleteUserData = async (options: DeleteUserDataOptions = {}) => {
  try {
    const receipt = await requestAccountDeletion(options.deleteAuth ? 'account' : 'data');
    return { receipt, error: null };
  } catch (error) {
    return { receipt: null, error: error as Error };
  }
};
export const deleteUserAccount = async (_options?: { avatarUrl?: string | null }) =>
  deleteUserData({ deleteAuth: true });
