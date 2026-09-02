import type { BabyMilestoneEntry } from '../milestones';
import { generateMilestonePhotobookPdf } from '../milestonePhotobookPdf';

const mockMakeDirectoryAsync = jest.fn();
const mockDownloadAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockManipulateAsync = jest.fn();
const mockPrintToFileAsync = jest.fn();
const mockImageGetSize = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
  downloadAsync: (...args: unknown[]) => mockDownloadAsync(...args),
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  copyAsync: (...args: unknown[]) => mockCopyAsync(...args),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
}));

jest.mock('expo-print', () => ({
  printToFileAsync: (...args: unknown[]) => mockPrintToFileAsync(...args),
}));

jest.mock('react-native/Libraries/Image/Image', () => ({
  __esModule: true,
  default: {
    getSize: (...args: unknown[]) => mockImageGetSize(...args),
  },
}));

const makeEntry = (overrides: Partial<BabyMilestoneEntry> = {}): BabyMilestoneEntry => ({
  id: 'entry-1',
  user_id: 'user-1',
  baby_id: 'baby-1',
  title: 'First steps',
  category: 'motorik',
  event_date: '2026-08-31',
  image_url: null,
  notes: null,
  created_at: '2026-08-31T12:00:00.000Z',
  updated_at: '2026-08-31T12:00:00.000Z',
  ...overrides,
});

describe('milestone photobook PDF export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
    mockWriteAsStringAsync.mockResolvedValue(undefined);
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 2048 });
    mockCopyAsync.mockResolvedValue(undefined);
    mockPrintToFileAsync.mockResolvedValue({
      uri: 'file:///cache/Print/generated.pdf',
      numberOfPages: 2,
    });
    mockImageGetSize.mockImplementation(
      (_uri: string, success: (width: number, height: number) => void) => success(2400, 1600),
    );
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///cache/manipulated.jpg',
      base64: 'normalized-photo',
      width: 1200,
      height: 800,
    });
  });

  it('normalizes remote photos before rendering the PDF', async () => {
    mockDownloadAsync.mockResolvedValue({
      uri: 'file:///cache/downloaded.jpg',
      status: 200,
      headers: {},
      mimeType: 'image/jpeg',
    });

    const result = await generateMilestonePhotobookPdf({
      entries: [makeEntry({ image_url: 'https://example.com/photo.jpg' })],
      babyName: 'Lotti',
    });

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file:///cache/downloaded.jpg',
      [{ resize: { width: 1200 } }],
      { base64: true, compress: 0.68, format: 'jpeg' },
    );
    expect(mockPrintToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('data:image/jpeg;base64,normalized-photo'),
        width: 595,
        height: 842,
      }),
    );
    expect(result.uri).toMatch(/^file:\/\/\/cache\/LottiBaby-fotobuch-lotti-/);
    expect(result.warnings).toEqual([]);
  });

  it('retries with placeholders when the native renderer rejects image-heavy HTML', async () => {
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///cache/manipulated.jpg',
      base64: 'normalized-photo',
      width: 800,
      height: 1200,
    });
    mockPrintToFileAsync
      .mockRejectedValueOnce(new Error('The web content process was terminated'))
      .mockResolvedValueOnce({
        uri: 'file:///cache/Print/fallback.pdf',
        numberOfPages: 2,
      });

    const result = await generateMilestonePhotobookPdf({
      entries: [makeEntry({ image_url: 'data:image/png;base64,original-photo' })],
      babyName: 'Lotti',
    });

    expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
      expect.stringMatching(/entry-1\.jpg$/),
      'original-photo',
      { encoding: 'base64' },
    );
    expect(mockPrintToFileAsync).toHaveBeenCalledTimes(2);
    expect(mockPrintToFileAsync.mock.calls[1][0].html).not.toContain('normalized-photo');
    expect(mockPrintToFileAsync.mock.calls[1][0].html).toContain('photo-placeholder');
    expect(result.warnings).toHaveLength(1);
  });

  it('shares the original generated file when cosmetic renaming fails', async () => {
    mockCopyAsync.mockRejectedValueOnce(new Error('copy failed'));

    const result = await generateMilestonePhotobookPdf({
      entries: [makeEntry()],
      babyName: 'Lotti',
    });

    expect(result.uri).toBe('file:///cache/Print/generated.pdf');
  });

  it('rejects an empty or missing native PDF result', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: true, size: 0 });

    await expect(
      generateMilestonePhotobookPdf({ entries: [makeEntry()] }),
    ).rejects.toThrow('keine lesbare PDF-Datei');
  });
});
