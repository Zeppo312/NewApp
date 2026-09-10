import { parseAccountLinkingQr } from '../account-linking-qr';

const nativeLink = 'com.lottibaby.app://invite?code=ABCD2345';

describe('account invitation QR data', () => {
  it.each([
    'ABCD2345',
    ' abcd2345\n',
    nativeLink,
    'com.lottibaby.app:///invite?code=abcd2345',
    'com.lottibaby.app://invite?code=%41BCD2345',
  ])('reads supported invitation %s', (data) => {
    expect(parseAccountLinkingQr(data, nativeLink)).toBe('ABCD2345');
  });

  it.each([
    'https://lottibaby.example/invite?code=ABCD2345',
    'exp://192.168.1.42:8081/--/invite?code=ABCD2345',
  ])('supports invitation links from the current web or Expo environment', (link) => {
    expect(parseAccountLinkingQr(link, link)).toBe('ABCD2345');
    expect(parseAccountLinkingQr(nativeLink, link)).toBe('ABCD2345');
  });

  it.each([
    '', 'hello', 'ABCDEFG', 'ABCDEFGHI', 'ABCD 2345',
    'https://unrelated.example/invite?code=ABCD2345',
    'com.lottibaby.app://profile?code=ABCD2345',
    'com.lottibaby.app://invite/extra?code=ABCD2345',
    'com.lottibaby.app://invite',
    'com.lottibaby.app://invite?code=',
    'com.lottibaby.app://invite?code=ABCD2345&code=EFGH6789',
    'com.lottibaby.app://user:password@invite?code=ABCD2345',
    'javascript:alert(1)',
  ])('rejects unrelated or malformed data %s', (data) => {
    expect(parseAccountLinkingQr(data, nativeLink)).toBeNull();
  });

  it('rejects a lookalike web origin', () => {
    expect(parseAccountLinkingQr(
      'https://lottibaby.example.attacker.test/invite?code=ABCD2345',
      'https://lottibaby.example/invite?code=',
    )).toBeNull();
  });
});
