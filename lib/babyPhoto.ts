import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from './supabase';

export const BABY_PHOTO_BUCKET = 'baby-profile-images';

export type PreparedBabyPhoto = {
  uri: string;
  bytes: Uint8Array;
};

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const getManagedPhotoPath = (photoUrl: string): string | null => {
  const marker = `/storage/v1/object/public/${BABY_PHOTO_BUCKET}/`;
  const markerIndex = photoUrl.indexOf(marker);
  if (markerIndex === -1) return null;

  const encodedPath = photoUrl
    .slice(markerIndex + marker.length)
    .split(/[?#]/, 1)[0];

  if (!encodedPath) return null;

  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
};

export const prepareBabyPhoto = async (
  localUri: string,
  dimensions?: { width?: number; height?: number },
): Promise<PreparedBabyPhoto> => {
  const width = dimensions?.width;
  const height = dimensions?.height;
  const resizeAction = width && height && Math.max(width, height) > 640
    ? width >= height
      ? { resize: { width: 640 } }
      : { resize: { height: 640 } }
    : undefined;

  const result = await ImageManipulator.manipulateAsync(
    localUri,
    resizeAction ? [resizeAction] : [],
    {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    },
  );
  // Die Legacy-API ist auch in bereits veröffentlichten Expo-57-Builds
  // vorhanden. Die neue File-Klasse kann bei einem reinen OTA-Update fehlen.
  const base64 = await FileSystem.readAsStringAsync(result.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToBytes(base64);

  return { uri: result.uri, bytes };
};

export const uploadBabyPhoto = async ({
  bytes,
  userId,
  babyId,
}: {
  bytes: Uint8Array;
  userId: string;
  babyId: string;
}): Promise<string> => {
  const filePath = `${userId}/${babyId}/baby_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BABY_PHOTO_BUCKET)
    .upload(filePath, bytes, {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(BABY_PHOTO_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
};

export const deleteBabyPhoto = async (photoUrl: string | null | undefined) => {
  if (!photoUrl) return;

  const filePath = getManagedPhotoPath(photoUrl);
  if (!filePath) return;

  const { error } = await supabase.storage.from(BABY_PHOTO_BUCKET).remove([filePath]);
  if (error) {
    throw error;
  }
};
