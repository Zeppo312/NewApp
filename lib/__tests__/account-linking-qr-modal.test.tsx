import React from 'react';
import { AppState, BackHandler, Linking, Modal, Text, type AppStateStatus } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CameraView } from 'expo-camera';
import { AccountLinkingQrModal } from '@/components/account-linking-qr-modal';

const mockPermission = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn().mockResolvedValue(mockPermission);
const mockGetPermission = jest.fn().mockResolvedValue(mockPermission);
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [mockPermission, mockRequestPermission, mockGetPermission],
}));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));

describe('account invitation scanner', () => {
  let tree: ReactTestRenderer;
  const onScanned = jest.fn();
  const onClose = jest.fn();
  let changeAppState: (state: AppStateStatus) => void;
  const link = 'com.lottibaby.app://invite?code=ABCD2345';
  const mount = async (code: string | null = null) => {
    await act(async () => {
      tree = create(<AccountLinkingQrModal code={code} invitationLink={link} locale="de" isDark={false} onScanned={onScanned} onClose={onClose} />);
    });
  };
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermission.granted = true;
    mockPermission.canAskAgain = true;
    AppState.currentState = 'active';
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      changeAppState = callback;
      return { remove: jest.fn() };
    });
  });
  afterEach(() => {
    act(() => tree?.unmount());
    jest.restoreAllMocks();
  });

  it('stays inside the page and closes on Android back', async () => {
    const remove = jest.fn();
    const subscribe = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
    await mount();
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    const handleBack = subscribe.mock.calls[0][1];
    act(() => { expect(handleBack()).toBe(true); });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('accepts a valid code only once even when the camera reports it repeatedly', async () => {
    await mount();
    const scan = tree.root.findByType(CameraView).props.onBarcodeScanned;
    act(() => { scan({ data: link }); scan({ data: link }); });
    expect(onScanned).toHaveBeenCalledTimes(1);
    expect(onScanned).toHaveBeenCalledWith('ABCD2345');
  });

  it('keeps scanning after an unrelated QR code', async () => {
    await mount();
    const scan = tree.root.findByType(CameraView).props.onBarcodeScanned;
    act(() => scan({ data: 'https://unrelated.example' }));
    expect(onScanned).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(Text).some(node => String(node.props.children).includes('kein gültiger'))).toBe(true);
    act(() => scan({ data: link }));
    expect(onScanned).toHaveBeenCalledWith('ABCD2345');
  });

  it('unmounts the camera in the background and restores it on return', async () => {
    await mount();
    act(() => changeAppState('background'));
    expect(tree.root.findAllByType(CameraView)).toHaveLength(0);
    await act(async () => changeAppState('active'));
    expect(tree.root.findAllByType(CameraView)).toHaveLength(1);
  });

  it('offers Settings when camera permission cannot be requested again', async () => {
    mockPermission.granted = false;
    mockPermission.canAskAgain = false;
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await mount();
    expect(tree.root.findAllByType(CameraView)).toHaveLength(0);
    const button = tree.root.findAll(node => node.props.accessibilityRole === 'button' &&
      node.findAllByType(Text).some(text => text.props.children === 'Einstellungen öffnen'))[0];
    await act(async () => button.props.onPress());
    expect(settings).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('stops the camera and explains how to continue if camera startup fails', async () => {
    await mount();
    act(() => tree.root.findByType(CameraView).props.onMountError({ message: 'Unavailable' }));
    expect(tree.root.findAllByType(CameraView)).toHaveLength(0);
    expect(tree.root.findAllByType(Text).some(node => String(node.props.children).includes('nicht geöffnet'))).toBe(true);
  });

  it('shows invitations without mounting or requesting the camera', async () => {
    await mount('ABCD2345');
    expect(tree.root.findAllByType(CameraView)).toHaveLength(0);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(Text).some(node => node.props.children === 'ABCD2345')).toBe(true);
  });
});
