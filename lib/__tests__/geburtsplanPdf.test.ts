import { Alert, Platform } from 'react-native';
import { generateAndDownloadPDF } from '../geburtsplan-utils';
import { translateBirthPlanText, type BirthPlanLocale } from '../birthPlanTranslations';

const mockGetGeburtsplan = jest.fn();
const mockPrintToFileAsync = jest.fn();
const mockPrintAsync = jest.fn();
const mockShareAsync = jest.fn();
const mockIsAvailableAsync = jest.fn();

jest.mock('../supabase', () => ({
  getGeburtsplan: (...args: unknown[]) => mockGetGeburtsplan(...args),
}));
jest.mock('expo-print', () => ({
  printAsync: (...args: unknown[]) => mockPrintAsync(...args),
  printToFileAsync: (...args: unknown[]) => mockPrintToFileAsync(...args),
}));
jest.mock('expo-sharing', () => ({
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
  isAvailableAsync: () => mockIsAvailableAsync(),
}));

const originalPlatform = Platform.OS;
const printUri = 'file:///cache/Print/generated.pdf';

describe('birth plan PDF export', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    Platform.OS = 'android';
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetGeburtsplan.mockResolvedValue({
      data: { structured_data: { allgemeineAngaben: { mutterName: 'Anna & Tom' } } },
      error: null,
    });
    mockPrintToFileAsync.mockResolvedValue({ uri: printUri });
    mockPrintAsync.mockResolvedValue(undefined);
    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
    jest.restoreAllMocks();
  });

  it('opens Android PDF saving when sharing rejects ALL paths, including the app cache', async () => {
    mockShareAsync.mockRejectedValue(new Error('Not allowed to read file under given URL.'));
    const setLoading = jest.fn();

    await generateAndDownloadPDF(null, setLoading);

    expect(mockPrintAsync).toHaveBeenCalledTimes(1);
    expect(mockPrintAsync).toHaveBeenCalledWith({
      html: expect.stringContaining('Anna &amp; Tom'),
    });
    expect(mockPrintToFileAsync).not.toHaveBeenCalled();
    expect(mockIsAvailableAsync).not.toHaveBeenCalled();
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(setLoading.mock.calls).toEqual([[true], [false]]);
  });

  it.each<BirthPlanLocale>(['de', 'en', 'es'])('preserves localized content and the embedded icon in %s', async (locale) => {
    await generateAndDownloadPDF('test-image', undefined, locale);

    const { html } = mockPrintAsync.mock.calls[0][0];
    expect(html).toContain(translateBirthPlanText(locale, 'export.myPlan'));
    expect(html).toContain('data:image/png;base64,test-image');
    expect(html).toContain('Anna &amp; Tom');
  });

  it('also sends legacy text plans to Android PDF saving', async () => {
    mockGetGeburtsplan.mockResolvedValue({
      data: { content: 'GEBURTSPLAN\n\n1. Allgemeine Angaben\nName: Anna' },
      error: null,
    });
    await generateAndDownloadPDF(null);

    expect(mockPrintAsync).toHaveBeenCalledWith({ html: expect.stringContaining('Anna') });
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: null },
    { data: null, error: new Error('Load failed') },
  ])('does not open export dialogs without a loaded plan: %o', async (result) => {
    mockGetGeburtsplan.mockResolvedValue(result);
    const setLoading = jest.fn();
    await generateAndDownloadPDF(null, setLoading);

    expect(mockPrintAsync).not.toHaveBeenCalled();
    expect(mockPrintToFileAsync).not.toHaveBeenCalled();
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(setLoading.mock.calls).toEqual([[true], [false]]);
  });

  it('keeps the native iOS PDF path and margins', async () => {
    Platform.OS = 'ios';
    await generateAndDownloadPDF(null);

    expect(mockPrintToFileAsync).toHaveBeenCalledWith(expect.objectContaining({
      base64: false,
      margins: { left: 24, right: 24, top: 72, bottom: 40 },
    }));
    expect(mockShareAsync).toHaveBeenCalledWith(printUri, expect.objectContaining({ UTI: 'com.adobe.pdf' }));
    expect(mockPrintAsync).not.toHaveBeenCalled();
  });

  it('finishes after opening the browser print dialog without trying to share a local file', async () => {
    Platform.OS = 'web';
    mockPrintToFileAsync.mockResolvedValue(undefined);
    const setLoading = jest.fn();
    await generateAndDownloadPDF(null, setLoading);

    expect(mockPrintToFileAsync).toHaveBeenCalledTimes(1);
    expect(mockIsAvailableAsync).not.toHaveBeenCalled();
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(setLoading.mock.calls).toEqual([[true], [false]]);
  });

  it('reports an unavailable share dialog on iOS', async () => {
    Platform.OS = 'ios';
    mockIsAvailableAsync.mockResolvedValue(false);
    await generateAndDownloadPDF(null);

    expect(mockPrintAsync).not.toHaveBeenCalled();
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it('keeps loading active until the Android dialog opens without claiming a completed save', async () => {
    let openDialog!: () => void;
    mockPrintAsync.mockReturnValue(new Promise<void>((resolve) => { openDialog = resolve; }));
    const setLoading = jest.fn();
    const exporting = generateAndDownloadPDF(null, setLoading);
    await Promise.resolve();

    expect(setLoading.mock.calls).toEqual([[true]]);
    openDialog();
    await exporting;

    // Android resolves on opening; later cancellation must not be reported as a save.
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(setLoading.mock.calls).toEqual([[true], [false]]);
  });

  it('resets loading and reports an Android print dialog failure', async () => {
    mockPrintAsync.mockRejectedValue(new Error('PrintManager unavailable'));
    const setLoading = jest.fn();
    await generateAndDownloadPDF(null, setLoading);

    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(setLoading.mock.calls).toEqual([[true], [false]]);
  });

  it('resets loading and reports a share failure on iOS', async () => {
    Platform.OS = 'ios';
    mockShareAsync.mockRejectedValue(new Error('Share failed'));
    const setLoading = jest.fn();
    await generateAndDownloadPDF(null, setLoading);

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(setLoading.mock.calls).toEqual([[true], [false]]);
  });
});
