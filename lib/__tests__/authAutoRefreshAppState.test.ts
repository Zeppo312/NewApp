/**
 * auth-js sieht unter React Native kein `document` und laesst seinen
 * Refresh-Ticker deshalb von sich aus dauerhaft laufen - auch waehrend iOS die
 * App suspendiert. Ein Refresh, der genau beim Wechsel in den Hintergrund
 * unterwegs ist, rotiert den Refresh-Token serverseitig, ohne dass die Antwort
 * ankommt; beim naechsten Start verwirft GoTrue die Sitzung als
 * "Already Used" und der Nutzer landet auf dem Login. Der Ticker muss deshalb
 * am AppState haengen.
 */
const mockStartAutoRefresh = jest.fn();
const mockStopAutoRefresh = jest.fn();
const appStateListeners: ((state: string) => void)[] = [];

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      startAutoRefresh: mockStartAutoRefresh,
      stopAutoRefresh: mockStopAutoRefresh,
    },
    from: jest.fn(),
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// react-native wird bewusst nicht als Ganzes ersetzt - das jest-expo-Preset
// laedt daraus beim Setup schon Platform & Co.
import { AppState } from 'react-native';

describe('Auto-Refresh folgt dem AppState', () => {
  beforeAll(() => {
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, callback) => {
        appStateListeners.push(callback as (state: string) => void);
        return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>;
      });
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });

    // Das Modul so laden, als liefe es unter React Native.
    (globalThis as unknown as { navigator: { product: string } }).navigator = {
      product: 'ReactNative',
    };
    jest.isolateModules(() => {
      require('../supabase');
    });
  });

  it('startet den Ticker, wenn die App beim Laden aktiv ist', () => {
    expect(mockStartAutoRefresh).toHaveBeenCalledTimes(1);
  });

  it('stoppt ihn im Hintergrund und startet ihn beim Aktivieren neu', () => {
    expect(appStateListeners).toHaveLength(1);

    appStateListeners[0]('background');
    expect(mockStopAutoRefresh).toHaveBeenCalledTimes(1);

    appStateListeners[0]('active');
    expect(mockStartAutoRefresh).toHaveBeenCalledTimes(2);
  });
});
