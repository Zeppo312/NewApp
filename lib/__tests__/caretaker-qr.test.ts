import { formatCaretakerCode, parseCaretakerQr } from '../caretaker-qr';
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
const code = '1234567890abcdef1234567890abcdef';
const link = `com.lottibaby.app://caregiver-join?code=${code}`;
it.each([
  code, formatCaretakerCode(code), link,
  `com.lottibaby.app:///caregiver-join?code=${code}`,
  `com.lottibaby.app://caregiver?code=${code}`,
])('reads a supported caregiver invitation %s', data => {
  expect(parseCaretakerQr(data, link)).toBe(code);
});
it.each([
  'ABCD1234', `com.lottibaby.app://invite?code=${code}`,
  `com.lottibaby.app://caregiver-join?code=${code}&code=${code}`,
  `com.lottibaby.app://caregiver-join?code=${code}#other`,
  `com.lottibaby.app://user:pass@caregiver-join?code=${code}`,
  `https://attacker.example/caregiver-join?code=${code}`,
  `com.lottibaby.app://caregiver-join/extra?code=${code}`,
])('rejects partner invitations and unrelated QR data %s', data => {
  expect(parseCaretakerQr(data, link)).toBeNull();
});
it.each(['https://lottibaby.example/caregiver-join', 'exp://192.168.1.2:8081/--/caregiver-join'])('supports the current web or Expo origin %s', base => {
  expect(parseCaretakerQr(`${base}?code=${code}`, `${base}?code=`)).toBe(code);
  expect(parseCaretakerQr(link, `${base}?code=`)).toBe(code);
});
it('rejects a lookalike web origin', () => {
  expect(parseCaretakerQr(`https://lottibaby.example.attacker.test/caregiver-join?code=${code}`, 'https://lottibaby.example/caregiver-join?code=')).toBeNull();
});
