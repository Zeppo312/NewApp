#!/usr/bin/env python3
"""Dedicated existing-production credential: stdin in, pipe out, never argv/env/files.

Uses the macOS file Keychain in the current user context. Background access fails
without UI if the login keychain is locked or the caller is not authorized.
"""
import ctypes as C
import sys

SERVICE = 'de.lottibaby.deletion-registry.production.kwniiyayhzgjfqjsjcfu'
ACCOUNT = 'registry-writer'
CF = C.CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
SEC = C.CDLL('/System/Library/Frameworks/Security.framework/Security')
P = C.c_void_p
CF.CFStringCreateWithCString.argtypes = [P, C.c_char_p, C.c_uint32]
CF.CFStringCreateWithCString.restype = P
CF.CFDictionaryCreateMutable.argtypes = [P, C.c_long, P, P]
CF.CFDictionaryCreateMutable.restype = P
CF.CFDictionarySetValue.argtypes = [P, P, P]
CF.CFDataCreate.argtypes = [P, C.c_char_p, C.c_long]
CF.CFDataCreate.restype = P
CF.CFDataGetLength.argtypes = [P]
CF.CFDataGetLength.restype = C.c_long
CF.CFDataGetBytePtr.argtypes = [P]
CF.CFDataGetBytePtr.restype = P
CF.CFRelease.argtypes = [P]
SEC.SecItemAdd.argtypes = [P, P]
SEC.SecItemAdd.restype = C.c_int32
SEC.SecItemCopyMatching.argtypes = [P, C.POINTER(P)]
SEC.SecItemCopyMatching.restype = C.c_int32
SEC.SecKeychainSetUserInteractionAllowed.argtypes = [C.c_bool]
SEC.SecKeychainSetUserInteractionAllowed.restype = C.c_int32


def constant(name, library=SEC):
    return P.in_dll(library, name).value


def text(value):
    return CF.CFStringCreateWithCString(None, value.encode(), 0x08000100)


def dictionary(values):
    callbacks_k = (C.c_byte * 48).in_dll(CF, 'kCFTypeDictionaryKeyCallBacks')
    callbacks_v = (C.c_byte * 40).in_dll(CF, 'kCFTypeDictionaryValueCallBacks')
    result = CF.CFDictionaryCreateMutable(None, 0, C.addressof(callbacks_k), C.addressof(callbacks_v))
    for key, value in values.items():
        CF.CFDictionarySetValue(result, constant(key), value)
    return result


def get():
    s, a = text(SERVICE), text(ACCOUNT)
    query = dictionary({'kSecClass': constant('kSecClassGenericPassword'),
                        'kSecAttrService': s, 'kSecAttrAccount': a,
                        'kSecReturnData': constant('kCFBooleanTrue', CF)})
    result = P()
    try:
        code = SEC.SecItemCopyMatching(query, C.byref(result))
        if code:
            raise RuntimeError(f'Keychain read unavailable (OSStatus {code})')
        length = CF.CFDataGetLength(result)
        if length < 32 or length > 16384:
            raise RuntimeError('Unexpected credential size')
        return C.string_at(CF.CFDataGetBytePtr(result), length)
    finally:
        if result:
            CF.CFRelease(result)
        CF.CFRelease(query)
        CF.CFRelease(s)
        CF.CFRelease(a)


def put(value):
    s, a, label = text(SERVICE), text(ACCOUNT), text('LottiBaby production deletion registry')
    data = CF.CFDataCreate(None, value, len(value))
    attributes = dictionary({'kSecClass': constant('kSecClassGenericPassword'),
                             'kSecAttrService': s, 'kSecAttrAccount': a,
                             'kSecAttrLabel': label, 'kSecValueData': data})
    try:
        code = SEC.SecItemAdd(attributes, None)
        if code == -25299:
            if get() != value:
                raise RuntimeError('Existing dedicated credential differs; it was preserved')
        elif code:
            raise RuntimeError(f'Keychain storage unavailable (OSStatus {code})')
        if get() != value:
            raise RuntimeError('Keychain readback mismatch')
    finally:
        for item in (attributes, s, a, label, data):
            CF.CFRelease(item)


def main():
    if sys.platform != 'darwin' or len(sys.argv) != 2 or sys.argv[1] not in ('get', 'put'):
        raise RuntimeError('Use get or put in the existing macOS user context')
    SEC.SecKeychainSetUserInteractionAllowed(False)
    if sys.argv[1] == 'put':
        value = sys.stdin.buffer.read(16385)
        if not 32 <= len(value) <= 16384 or b'\n' in value:
            raise RuntimeError('Invalid credential input')
        put(value)
        print('{"stored":true,"exactReadback":true}')
    else:
        sys.stdout.buffer.write(get())


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Error strings contain only our fixed messages and numeric OSStatus.
        print(str(error), file=sys.stderr)
        sys.exit(1)
