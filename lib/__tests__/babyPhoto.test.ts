import {
  BABY_PHOTO_BUCKET,
  deleteBabyPhoto,
  prepareBabyPhoto,
  uploadBabyPhoto,
} from '../babyPhoto';

const mockManipulateAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));

jest.mock('../supabase', () => {
  const upload = jest.fn();
  const remove = jest.fn();
  const getPublicUrl = jest.fn();
  return {
    supabase: {
      storage: {
        from: jest.fn(() => ({ upload, remove, getPublicUrl })),
      },
    },
    storageMocks: { upload, remove, getPublicUrl },
  };
});

const supabaseMock = jest.requireMock('../supabase');
const mockFrom = supabaseMock.supabase.storage.from as jest.Mock;
const {
  upload: mockUpload,
  remove: mockRemove,
  getPublicUrl: mockGetPublicUrl,
} = supabaseMock.storageMocks as Record<string, jest.Mock>;
describe('baby photo storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///tmp/prepared.jpg',
    });
    mockReadAsStringAsync.mockResolvedValue('AQID');
    mockUpload.mockResolvedValue({ error: null });
    mockRemove.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl: `https://example.supabase.co/storage/v1/object/public/${BABY_PHOTO_BUCKET}/user-1/baby-1/photo.jpg`,
      },
    });
  });

  it('prepares a bounded local preview before uploading its JPEG bytes', async () => {
    const preparedPhoto = await prepareBabyPhoto('file:///tmp/baby.heic', {
      width: 3024,
      height: 4032,
    });

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file:///tmp/baby.heic',
      [{ resize: { height: 640 } }],
      { base64: false, compress: 0.72, format: 'jpeg' },
    );
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(
      'file:///tmp/prepared.jpg',
      { encoding: 'base64' },
    );
    expect(preparedPhoto).toEqual({
      uri: 'file:///tmp/prepared.jpg',
      bytes: new Uint8Array([1, 2, 3]),
    });

    const publicUrl = await uploadBabyPhoto({
      bytes: preparedPhoto.bytes,
      userId: 'user-1',
      babyId: 'baby-1',
    });

    expect(mockFrom).toHaveBeenCalledWith(BABY_PHOTO_BUCKET);
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/baby-1\/baby_\d+_[a-z0-9]+\.jpg$/),
      new Uint8Array([1, 2, 3]),
      {
        cacheControl: '3600',
        contentType: 'image/jpeg',
        upsert: false,
      },
    );
    expect(publicUrl).toContain('/user-1/baby-1/photo.jpg');
  });

  it('deletes managed storage photos but ignores legacy base64 values', async () => {
    await deleteBabyPhoto(
      `https://example.supabase.co/storage/v1/object/public/${BABY_PHOTO_BUCKET}/user-1/baby-1/old%20photo.jpg`,
    );
    expect(mockRemove).toHaveBeenCalledWith(['user-1/baby-1/old photo.jpg']);

    mockRemove.mockClear();
    await deleteBabyPhoto('data:image/jpeg;base64,abc');
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
