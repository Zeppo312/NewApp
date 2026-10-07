// Existing regression fixtures exercise the old published app's behavior.
// Consent suites opt in explicitly and also cover the new default-on path.
process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED = 'false';

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
