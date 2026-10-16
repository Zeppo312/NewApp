import React from 'react';
import { Alert } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Screen from '@/app/dsgvo';
import { exportUserData } from '@/lib/dataExport';

let mockLocale: 'de' | 'en' | 'es' = 'de';
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' }, signOut: jest.fn() }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: mockLocale }) }));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/lib/dataExport', () => ({ exportUserData: jest.fn() }));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => { act(() => tree?.unmount()); jest.restoreAllMocks(); });

const labels = {
  de: { button: 'Daten exportieren', error: 'Fehler', success: 'Export abgeschlossen', warning: 'Export mit Hinweisen', incomplete: 'unvollständig' },
  en: { button: 'Export data', error: 'Error', success: 'Export complete', warning: 'Export with warnings', incomplete: 'incomplete' },
  es: { button: 'Exportar datos', error: 'Error', success: 'Exportación completada', warning: 'Exportación con avisos', incomplete: 'incompleto' },
};
const button = () => tree.root.findAll(n => typeof n.props.onPress === 'function' && n.findAll(c => c.props.children === labels[mockLocale].button).length > 0)[0];
const pressExport = async () => { await act(async () => { button().props.onPress(); }); };

describe.each(['de', 'en', 'es'] as const)('%s export feedback', locale => {
  beforeEach(async () => { mockLocale = locale; await act(async () => { tree = create(<Screen />); }); });

  it('shows an error after an unsuccessful export and allows a successful retry', async () => {
    jest.mocked(exportUserData).mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: true, summary: { baby_info: 2 }, warnings: [] });
    await pressExport();
    expect(Alert.alert).toHaveBeenLastCalledWith(labels[locale].error, expect.any(String));
    expect(button().props.disabled).toBe(false);
    await pressExport();
    expect(Alert.alert).toHaveBeenLastCalledWith(labels[locale].success, expect.stringContaining('2'));
  });

  it('clearly warns about an incomplete export instead of reporting unqualified success', async () => {
    jest.mocked(exportUserData).mockResolvedValue({ success: true, summary: { baby_info: 0 }, warnings: ['Synthetic query failure'] });
    await pressExport();
    expect(Alert.alert).toHaveBeenLastCalledWith(labels[locale].warning, expect.stringContaining(labels[locale].incomplete));
    expect(Alert.alert).not.toHaveBeenCalledWith(labels[locale].success, expect.anything());
  });

  it('accepts an empty export when all queries succeeded', async () => {
    jest.mocked(exportUserData).mockResolvedValue({ success: true, summary: { baby_info: 0 }, warnings: [] });
    await pressExport();
    expect(Alert.alert).toHaveBeenLastCalledWith(labels[locale].success, expect.stringContaining('0'));
  });
});
