import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_FLOATING_VOICE_BUTTON_COLOR,
  readFloatingVoiceButtonColor,
  writeFloatingVoiceButtonColor,
} from '../voiceLog/floatingButton';

describe('lokale Farbe des schwebenden Sprach-Buttons', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('verwendet ohne gespeicherte Auswahl weiterhin Lila', async () => {
    await expect(readFloatingVoiceButtonColor()).resolves.toBe(
      DEFAULT_FLOATING_VOICE_BUTTON_COLOR,
    );
  });

  it('speichert und liest eine Farbauswahl lokal', async () => {
    await writeFloatingVoiceButtonColor('teal');

    await expect(readFloatingVoiceButtonColor()).resolves.toBe('teal');
  });

  it('faellt bei einem unbekannten gespeicherten Wert sicher auf den Standard zurueck', async () => {
    await AsyncStorage.setItem('voice_floating_button_color_v1', 'unsichtbar');

    await expect(readFloatingVoiceButtonColor()).resolves.toBe(
      DEFAULT_FLOATING_VOICE_BUTTON_COLOR,
    );
  });
});
