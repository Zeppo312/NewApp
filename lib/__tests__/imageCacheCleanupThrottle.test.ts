jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  downloadAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { MD5: 'MD5' },
  digestStringAsync: jest.fn().mockResolvedValue('hash'),
}));

const METADATA_KEY = 'image_cache_metadata';
const TIMESTAMP_KEY = 'image_cache_last_cleanup';
const DAY_MS = 24 * 60 * 60 * 1000;

// imageCache haelt Metadaten und den laufenden Cleanup im Modul-Scope. Deshalb
// wird pro Test frisch geladen - inklusive AsyncStorage, damit Test und Modul
// dieselbe Mock-Instanz benutzen.
const loadModules = () => {
  jest.resetModules();
  const storageModule = require('@react-native-async-storage/async-storage');
  const storage = storageModule.default ?? storageModule;
  const fileSystem = require('expo-file-system/legacy');
  fileSystem.getInfoAsync.mockResolvedValue({ exists: true });
  fileSystem.deleteAsync.mockResolvedValue(undefined);
  return { storage, fileSystem, imageCache: require('../imageCache') };
};

const seedExpiredEntry = async (storage: any) => {
  await storage.setItem(
    METADATA_KEY,
    JSON.stringify({
      abc: {
        url: 'https://example.com/a.png',
        cachedAt: Date.now() - 30 * DAY_MS,
        size: 1024 * 1024,
      },
    }),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('maybeCleanupCache', () => {
  it('bereinigt beim ersten Lauf und merkt sich den Zeitpunkt', async () => {
    const { storage, imageCache } = loadModules();
    await seedExpiredEntry(storage);

    const result = await imageCache.maybeCleanupCache();

    expect(result.skipped).toBe(false);
    expect(result.removed).toBe(1);
    expect(await storage.getItem(TIMESTAMP_KEY)).not.toBeNull();
  });

  it('ueberspringt einen zweiten Lauf am selben Tag', async () => {
    const { storage, fileSystem, imageCache } = loadModules();
    await seedExpiredEntry(storage);
    await storage.setItem(TIMESTAMP_KEY, String(Date.now() - 60 * 1000));

    const result = await imageCache.maybeCleanupCache();

    expect(result.skipped).toBe(true);
    expect(result.removed).toBe(0);
    expect(fileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('laeuft wieder, sobald der letzte Lauf ueber einen Tag zurueckliegt', async () => {
    const { storage, imageCache } = loadModules();
    await seedExpiredEntry(storage);
    await storage.setItem(TIMESTAMP_KEY, String(Date.now() - 2 * DAY_MS));

    const result = await imageCache.maybeCleanupCache();

    expect(result.skipped).toBe(false);
    expect(result.removed).toBe(1);
  });

  it('laesst nicht abgelaufene Eintraege unangetastet', async () => {
    const { storage, fileSystem, imageCache } = loadModules();
    await storage.setItem(
      METADATA_KEY,
      JSON.stringify({
        abc: { url: 'https://example.com/a.png', cachedAt: Date.now(), size: 10 },
      }),
    );

    const result = await imageCache.maybeCleanupCache();

    expect(result.removed).toBe(0);
    expect(fileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('teilt parallele Aufrufe denselben Durchlauf', async () => {
    const { storage, fileSystem, imageCache } = loadModules();
    await seedExpiredEntry(storage);

    const [first, second] = await Promise.all([
      imageCache.maybeCleanupCache(),
      imageCache.maybeCleanupCache(),
    ]);

    expect(fileSystem.deleteAsync).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });
});
