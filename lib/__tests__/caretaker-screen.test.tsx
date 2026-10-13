import React from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, Text, TextInput, type AppStateStatus } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import CaretakerScreen, { CareSession } from '@/components/caretaker/caretaker-screen';
import { caretakerRequest, type CaretakerSnapshot } from '@/lib/caretaker-access';
import Header from '@/components/Header';
import BabySwitcherButton from '@/components/BabySwitcherButton';
import SleepQuickAddModal, { TimePickerField } from '@/components/SleepQuickAddModal';
import { caretakerCopy } from '@/lib/caretaker-copy';
import ActivityInputModal from '@/components/ActivityInputModal';
import CustomActivityEntryModal from '@/components/CustomActivityEntryModal';
import ActivityCard from '@/components/ActivityCard';
import { DailyQuickAction } from '@/components/tracking/DailyQuickAction';
import { SleepTimerFace } from '@/components/tracking/SleepTimerFace';
import { SleepCaptureButton } from '@/components/tracking/SleepCaptureButton';
import { AccountLinkingQrModal } from '@/components/account-linking-qr-modal';

let mockTier: string | null = 'premium';
jest.mock('@/lib/entitlements', () => ({ useSubscriptionTier: () => mockTier }));
jest.mock('@/components/CustomActivityEntryModal', () => () => null);
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('@/lib/caretaker-access', () => ({ ...jest.requireActual('@/lib/caretaker-access'), caretakerRequest: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: (path: string, options: any) => `com.lottibaby.app://${path.replace(/^\//, '')}?code=${options.queryParams.code}` }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}), Stack: { Screen: () => null }, router: {},
  useFocusEffect: (callback: () => void | (() => void)) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@/components/account-linking-qr-modal', () => ({ AccountLinkingQrModal: () => null }));
jest.mock('@/components/Header', () => () => null);
jest.mock('@/components/BabySwitcherButton', () => () => null);
jest.mock('@/components/SleepQuickAddModal', () => ({ __esModule: true, default: () => null, TimePickerField: () => null }));
jest.mock('@/components/ActivityInputModal', () => () => null);
jest.mock('@/components/ActivityCard', () => ({ entry }: any) => require('react').createElement(require('react-native').Text, {}, entry.notes));
jest.mock('@/components/tracking/SleepTimerFace', () => ({ SleepTimerFace: () => null }));
jest.mock('@/components/tracking/SleepCaptureButton', () => ({ SleepCaptureButton: ({ title, onPress }: any) => require('react').createElement(require('react-native').Pressable, { accessibilityLabel: title, onPress }) }));
jest.mock('@/components/animations/AnimatedButton', () => 'AnimatedButton');
jest.mock('@/components/tracking/DailyQuickAction', () => ({ DailyQuickAction: 'DailyQuickAction' }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'grandma' } }) }));
jest.mock('@/contexts/ActiveBabyContext', () => ({ useActiveBaby: () => ({ babies: [{ id: 'baby', name: 'Test baby' }], activeBabyId: 'baby', activeBaby: { id: 'baby', name: 'Test baby' } }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light' }) }));
jest.mock('@/constants/DesignGuide', () => ({ LAYOUT_PAD: 20, LiquidGlassCard: jest.requireActual('react-native').View }));

const request = jest.mocked(caretakerRequest);
const t = caretakerCopy('de');
const data: CaretakerSnapshot = {
  server_now: '2026-09-09T10:00:00Z', starts_at: '2026-09-09T09:00:00Z', ends_at: '2026-09-09T11:00:00Z', visible_from: '2026-09-07T09:00:00Z',
  baby_name: 'Test baby', allow_entries: true,
  sleep: [{ id: 'sleep', start_time: '2026-09-09T09:30:00Z', end_time: null, notes: 'PRIVATE_SLEEP' }], daily: [],
};
const props = {
  t, locale: 'de', dark: false, foreground: '#000', accent: '#765397', formatDate: (x: string) => x,
  text: (x: string) => <Text>{x}</Text>,
  button: (label: string, onPress: () => void, disabled?: boolean) => <Pressable accessibilityLabel={label} onPress={onPress} disabled={disabled}><Text>{label}</Text></Pressable>,
  inputStyle: {}, cardStyle: {}, grantId: 'grant', request: caretakerRequest,
};

describe('caretaker session privacy lifecycle', () => {
  let tree: ReactTestRenderer;
  let changeState: (state: AppStateStatus) => void;
  const containsPrivateData = () => tree.root.findAllByType(Text).some(n => n.props.children === 'PRIVATE_SLEEP');
  beforeEach(() => {
    mockTier = 'premium';
    jest.useFakeTimers();
    request.mockReset(); request.mockResolvedValue(data);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, callback) => { changeState = callback; return { remove: jest.fn() }; });
  });
  afterEach(() => { if (tree) act(() => tree.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });
  async function mount() { await act(async () => { tree = create(<CareSession {...props} />); }); }
  it('reuses the standard header, baby switcher and both sleep date/time fields', async () => {
    request.mockResolvedValue([]);
    await act(async () => { tree = create(<CaretakerScreen />); });
    expect(tree.root.findAllByType(Header)).toHaveLength(1);
    const fields = tree.root.findAllByType(TimePickerField);
    expect(fields.map(f => f.props.label)).toEqual([t.start, t.end]);
    expect(tree.root.findAllByType(BabySwitcherButton).every(b => b.props.navigateOnSelect === false)).toBe(true);
  });
  it.each(['lite', 'standard'])('requires Premium to invite with %s, while guest sessions remain usable', async tier => {
    mockTier = tier;
    request.mockResolvedValue([]);
    await act(async () => { tree = create(<CaretakerScreen />); });
    expect(tree.root.findAllByType(TimePickerField)).toHaveLength(0);
    expect(tree.root.findAllByType(Text).some(n => n.props.children === t.premiumRequired)).toBe(true);
    act(() => tree.unmount());
    request.mockResolvedValue(data);
    await mount();
    expect(containsPrivateData()).toBe(true);
  });
  it('shows and records custom activities using the shared definition and edits custom entries in their own dialog', async () => {
    const definition = { id: 'bath', name: 'Baden', emoji: '🛁', color: '#123456', tracking_mode: 'event', unit: null, default_quantity: null };
    const entry = { id: 'custom-entry', entry_type: 'custom', start_time: data.starts_at, end_time: data.starts_at, notes: 'Baden', can_edit: true,
      custom_activity_type_id: 'bath', custom_name: 'Baden', custom_emoji: '🛁', custom_color: '#123456', custom_tracking_mode: 'event' };
    request.mockResolvedValue({ ...data, custom_activities: [definition], daily: [entry] });
    await mount();
    act(() => tree.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityState?.selected === false && typeof node.props.onPress === 'function')[0].props.onPress());
    const action = tree.root.findAllByType(DailyQuickAction).find(n => n.props.label === 'Baden')!;
    expect(action.props.emoji).toBe('🛁');
    act(() => action.props.onPress());
    await act(async () => tree.root.findByType(CustomActivityEntryModal).props.onSave({ start_time: data.starts_at, end_time: data.starts_at, custom_quantity: null, notes: 'Bath' }));
    expect(request).toHaveBeenCalledWith('write', expect.objectContaining({ command: 'custom', custom_activity_type_id: 'bath' }));
    act(() => tree.root.findByType(ActivityCard).props.onEdit());
    expect(tree.root.findByType(CustomActivityEntryModal).props.initialData.id).toBe('custom-entry');
    expect(tree.root.findAllByType(ActivityInputModal)).toHaveLength(0);
  });
  it('shows exactly the two care tabs and allows recording when authorized', async () => {
    await mount();
    expect(tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'tab')).toHaveLength(2);
    expect(containsPrivateData()).toBe(true);
    expect(tree.root.findAllByProps({ accessibilityLabel: t.stopSleep }).length).toBeGreaterThan(0);
  });
  it('removes parent-side joining and shows the QR code immediately after creating care', async () => {
    const code = '1234567890abcdef1234567890abcdef';
    request.mockImplementation(async action => action === 'create' ? { id: 'grant', label: 'Oma', invitation_code: code } : []);
    await act(async () => { tree = create(<CaretakerScreen />); });
    expect(tree.root.findAllByProps({ accessibilityLabel: t.code })).toHaveLength(0);
    act(() => tree.root.findByType(TextInput).props.onChangeText('Oma'));
    const createButton = tree.root.findAll(node => node.type === 'AnimatedButton' as any).find(n => n.props.children?.props?.children === t.create)!;
    await act(async () => createButton.props.onPress());
    expect(tree.root.findByType(AccountLinkingQrModal).props).toMatchObject({ code, displayCode: '1234 5678 90AB CDEF 1234 5678 90AB CDEF' });
    expect(tree.root.findByType(AccountLinkingQrModal).props.invitationLink).toContain('caregiver-join');
    expect(request.mock.calls.filter(([action]) => action === 'list')).toHaveLength(1);
  });
  const createButton = () => tree.root.findAll(node => node.type === 'AnimatedButton' as any)
    .find(n => [t.create, t.creating].includes(n.props.children?.props?.children))!;
  it('explains the missing caregiver name when pressing create instead of silently disabling it', async () => {
    request.mockResolvedValue([]);
    await act(async () => { tree = create(<CaretakerScreen />); });
    expect(createButton().props.disabled).toBe(false);
    await act(async () => createButton().props.onPress());
    expect(Alert.alert).toHaveBeenCalledWith(t.create, t.requiredName);
    expect(request.mock.calls.some(([action]) => action === 'create')).toBe(false);
  });
  it('shows a missing-backend error both in an alert and beside the create button', async () => {
    request.mockImplementation(async action => {
      if (action === 'create') throw { code: 'PGRST202' };
      return [];
    });
    await act(async () => { tree = create(<CaretakerScreen />); });
    act(() => tree.root.findByType(TextInput).props.onChangeText('Oma'));
    await act(async () => createButton().props.onPress());
    expect(Alert.alert).toHaveBeenCalledWith(t.create, t.unavailable);
    expect(tree.root.findAllByType(Text).some(n => n.props.accessibilityRole === 'alert' && n.props.children === t.unavailable)).toBe(true);
    expect(createButton().props.disabled).toBe(false);
    expect(tree.root.findByType(TextInput).props.value).toBe('Oma');
    expect(tree.root.findAllByType(AccountLinkingQrModal)).toHaveLength(0);
  });
  it('indicates progress and prevents duplicate submissions while the server responds', async () => {
    let resolve!: (value: unknown) => void;
    request.mockImplementation(action => action === 'create' ? new Promise(r => { resolve = r; }) : Promise.resolve([]));
    await act(async () => { tree = create(<CaretakerScreen />); });
    act(() => tree.root.findByType(TextInput).props.onChangeText('Oma'));
    const submit = createButton().props.onPress;
    await act(async () => { submit(); submit(); });
    expect(createButton().props.disabled).toBe(true);
    expect(tree.root.findByType(ActivityIndicator).props.accessibilityLabel).toBe(t.creating);
    expect(request.mock.calls.filter(([action]) => action === 'create')).toHaveLength(1);
    await act(async () => resolve({ id: 'grant', label: 'Oma', invitation_code: 'a'.repeat(32) }));
    expect(tree.root.findByType(AccountLinkingQrModal)).toBeDefined();
  });
  it('uses the standard timer and input dialogs with read-only entry cards', async () => {
    request.mockResolvedValue({ ...data, sleep: [] });
    await mount();
    expect(tree.root.findByType(SleepTimerFace)).toBeDefined();
    const manual = tree.root.findAllByType(SleepCaptureButton).find(n => n.props.kind === 'manual')!;
    act(() => manual.props.onPress());
    const modal = tree.root.findByType(SleepQuickAddModal);
    expect(modal.props.visible).toBe(true);
    await act(async () => modal.props.onSave({ start: new Date(data.starts_at), end: new Date(data.server_now), quality: 'good', notes: 'manual' }));
    expect(request).toHaveBeenCalledWith('write', expect.objectContaining({ command: 'sleep_add', start_time: new Date(data.starts_at).toISOString(), quality: 'good' }));
  });
  it('opens the normal daily dialog before writing, with unrelated features disabled', async () => {
    await mount();
    act(() => tree.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityState?.selected === false && typeof node.props.onPress === 'function')[0].props.onPress());
    act(() => tree.root.findAllByType(DailyQuickAction)[0].props.onPress());
    expect(request.mock.calls.some(([action]) => action === 'write')).toBe(false);
    const modal = tree.root.findByType(ActivityInputModal);
    expect(modal.props).toMatchObject({ restricted: true, activityType: 'feeding', initialSubType: 'feeding_bottle' });
    expect(modal.props.onDelete).toBeUndefined();
    await act(async () => modal.props.onSave({ entry_type: 'feeding', feeding_type: 'BOTTLE', feeding_volume_ml: 150, start_time: data.server_now, notes: 'bottle' }));
    expect(request).toHaveBeenCalledWith('write', expect.objectContaining({ command: 'bottle', volume_ml: 150, notes: 'bottle' }));
  });
  it('renders existing entries through the normal card without edit or delete access', async () => {
    await mount();
    expect(tree.root.findByType(ActivityCard).props.readOnly).toBe(true);
    expect(tree.root.findByType(ActivityCard).props.onEdit).toBeUndefined();
  });
  it('opens own sleep with existing values and saves a correction without creating a new entry', async () => {
    request.mockResolvedValue({ ...data, sleep: [{ ...data.sleep[0], can_edit: true, quality: 'medium' }] });
    await mount();
    const card = tree.root.findByType(ActivityCard);
    expect(card.props.readOnly).toBe(false);
    act(() => card.props.onEdit());
    const modal = tree.root.findByType(SleepQuickAddModal);
    expect(modal.props.initialEntry).toMatchObject({ quality: 'medium', notes: 'PRIVATE_SLEEP', end: null });
    await act(async () => modal.props.onSave({ ...modal.props.initialEntry, end: new Date(data.server_now), notes: 'corrected' }));
    expect(request).toHaveBeenCalledWith('write', expect.objectContaining({ command: 'sleep_update', entry_id: 'sleep', notes: 'corrected' }));
  });
  it('requires confirmation before deleting an own entry', async () => {
    request.mockResolvedValue({ ...data, sleep: [{ ...data.sleep[0], can_edit: true }] });
    await mount();
    act(() => tree.root.findByType(ActivityCard).props.onDelete('sleep'));
    expect(request.mock.calls.some(([action]) => action === 'write')).toBe(false);
    const options = jest.mocked(Alert.alert).mock.calls[0][2]!;
    expect(options[0].style).toBe('cancel');
    await act(async () => options[1].onPress!());
    expect(request).toHaveBeenCalledWith('write', expect.objectContaining({ command: 'sleep_delete', entry_id: 'sleep' }));
  });
  it('prefills own feeding entries and routes edits to the update command', async () => {
    request.mockResolvedValue({ ...data, daily: [{ id: 'bottle', start_time: data.starts_at, end_time: data.server_now, entry_type: 'feeding', feeding_type: 'BOTTLE', feeding_volume_ml: 120, notes: 'original', can_edit: true }] });
    await mount();
    act(() => tree.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityState?.selected === false && typeof node.props.onPress === 'function')[0].props.onPress());
    act(() => tree.root.findByType(ActivityCard).props.onEdit());
    const modal = tree.root.findByType(ActivityInputModal);
    expect(modal.props.initialData).toMatchObject({ id: 'bottle', notes: 'original', feeding_volume_ml: 120 });
    const initialValues = modal.props.initialData; const hiddenTypes = modal.props.hiddenSubTypes;
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(tree.root.findByType(ActivityInputModal).props.initialData).toBe(initialValues);
    expect(tree.root.findByType(ActivityInputModal).props.hiddenSubTypes).toBe(hiddenTypes);
    await act(async () => modal.props.onSave({ ...modal.props.initialData, entry_type: 'feeding', feeding_volume_ml: 150 }));
    expect(request).toHaveBeenCalledWith('write', expect.objectContaining({ command: 'daily_update', entry_id: 'bottle', volume_ml: 150 }));
  });
  it('hides source data in the background and revalidates before showing it again', async () => {
    await mount();
    act(() => changeState('background'));
    expect(containsPrivateData()).toBe(false);
    request.mockRejectedValueOnce({ message: 'access_inactive' });
    await act(async () => changeState('active'));
    expect(containsPrivateData()).toBe(false);
  });
  it('discards a late response after the app leaves the foreground', async () => {
    let resolve!: (value: CaretakerSnapshot) => void;
    request.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await mount();
    act(() => changeState('background'));
    await act(async () => resolve(data));
    expect(containsPrivateData()).toBe(false);
  });
  it('removes stale data even if the next request never finishes', async () => {
    await mount();
    request.mockImplementation(() => new Promise(() => {}));
    await act(async () => { jest.advanceTimersByTime(30_250); });
    expect(containsPrivateData()).toBe(false);
  });
  it('clears data at expiry without waiting for the next poll', async () => {
    request.mockResolvedValue({ ...data, ends_at: '2026-09-09T10:00:01Z' });
    await mount();
    expect(containsPrivateData()).toBe(true);
    await act(async () => { jest.advanceTimersByTime(1_250); });
    expect(containsPrivateData()).toBe(false);
  });
  it('offers no write controls for read-only invitations', async () => {
    request.mockResolvedValue({ ...data, allow_entries: false });
    await mount();
    expect(containsPrivateData()).toBe(true);
    expect(tree.root.findAllByProps({ accessibilityLabel: t.stopSleep })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: t.notes })).toHaveLength(0);
  });
});
