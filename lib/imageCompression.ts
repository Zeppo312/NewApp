import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

type CompressInput = { uri?: string; base64?: string };

type CompressOptions = {
  /**
   * Max dimension (longer edge) in px. Defaults to 1280.
   */
  maxDimension?: number;
  /**
   * JPEG quality 0-1. Defaults to 0.72.
   */
  quality?: number;
};

const getDimensions = async (uri: string) => {
  return new Promise<{ width?: number; height?: number }>((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: undefined, height: undefined })
    );
  });
};

const b64ToBytes = (base64: string) => {
  const cleaned = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
  const binary = atob(cleaned);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return { cleaned, bytes: array };
};

/**
 * Compress & resize an image (base64 or file URI) to a JPEG with bounded dimensions.
 * Returns JPEG bytes and data URL ready for uploads or inline storage.
 */
export const compressImage = async (
  input: CompressInput,
  options: CompressOptions = {}
): Promise<{ bytes: Uint8Array; base64: string; dataUrl: string }> => {
  const maxDimension = options.maxDimension ?? 1280;
  const quality = options.quality ?? 0.72;

  let sourceUri = input.uri;
  let createdTemp = false;

  if (!sourceUri && input.base64) {
    const { cleaned } = b64ToBytes(input.base64);
    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
    sourceUri = `${baseDir}img-${Date.now()}.jpg`;
    const base64Encoding =
      (FileSystem as any).EncodingType?.Base64 ??
      (FileSystem as any).EncodingType?.BASE64 ??
      'base64';
    await FileSystem.writeAsStringAsync(sourceUri, cleaned, {
      encoding: base64Encoding as FileSystem.EncodingType,
    });
    createdTemp = true;
  }

  if (!sourceUri) {
    throw new Error('Kein Bild zum Komprimieren gefunden');
  }

  const { width, height } = await getDimensions(sourceUri);
  const maxSide = width && height ? Math.max(width, height) : undefined;

  const resizeAction =
    maxSide && maxSide > maxDimension
      ? width && height && width >= height
        ? { resize: { width: maxDimension } }
        : { resize: { height: maxDimension } }
      : undefined;

  const result = await ImageManipulator.manipulateAsync(
    sourceUri,
    resizeAction ? [resizeAction] : [],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  const base64 = result.base64 ?? input.base64 ?? '';
  const { bytes } = b64ToBytes(base64);

  if (createdTemp) {
    try {
      await FileSystem.deleteAsync(sourceUri, { idempotent: true });
    } catch {
      // ignore cleanup errors
    }
  }

  return {
    bytes,
    base64,
    dataUrl: `data:image/jpeg;base64,${base64}`,
  };
};
