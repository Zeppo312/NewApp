#!/usr/bin/env python3
"""Verify a downloaded APK against an independently recorded signing fingerprint.

Usage: JAVA_HOME=... python3 scripts/verify-android-apk.py app.apk SDK_ROOT SHA256
Requires Android build-tools 36.0.0. Prints evidence without reading private keys.
"""
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import sys
import zipfile

apk, sdk, expected = sys.argv[1:]
build_tools = Path(sdk) / 'build-tools' / '36.0.0'


def run(tool, *args):
    return subprocess.check_output([str(build_tools / tool), *args], text=True)


signature = run('apksigner', 'verify', '--verbose', '--print-certs', apk)
actual = re.findall(r'^Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9]+)$', signature, re.M)
assert actual == [expected.replace(':', '').lower()], 'Signing fingerprint does not match EAS credentials'
run('zipalign', '-c', '-P', '16', '-v', '4', apk)
badging = run('aapt', 'dump', 'badging', apk)
assert "package: name='com.LottiBaby.app'" in badging, 'Unexpected applicationId'
assert 'application-debuggable' not in badging, 'APK is debuggable'
assert int(re.search(r"targetSdkVersion:'(\d+)'", badging)[1]) >= 36, 'Target API below 36'

alignment = {}
with zipfile.ZipFile(apk) as z:
    for name in z.namelist():
        if not name.endswith('.so') or not name.startswith(('lib/arm64-v8a/', 'lib/x86_64/')):
            continue
        data = z.read(name)
        assert data[:5] == b'\x7fELF\x02', f'Expected ELF64: {name}'
        endian = '<' if data[5] == 1 else '>'
        phoff = struct.unpack_from(endian + 'Q', data, 32)[0]
        phentsize, phnum = struct.unpack_from(endian + 'HH', data, 54)
        segments = []
        for index in range(phnum):
            offset = phoff + index * phentsize
            if struct.unpack_from(endian + 'I', data, offset)[0] == 1:  # PT_LOAD
                file_offset, virtual_address = struct.unpack_from(endian + 'QQ', data, offset + 8)
                align = struct.unpack_from(endian + 'Q', data, offset + 48)[0]
                assert align >= 16384 and (virtual_address - file_offset) % 16384 == 0, f'ELF not 16 KB aligned: {name}'
                segments.append(align)
        assert segments, f'No load segments: {name}'
        alignment[name] = segments
assert alignment, 'APK contains no 64-bit native libraries'

digest = hashlib.sha256()
with open(apk, 'rb') as stream:
    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
        digest.update(chunk)
print(json.dumps({
    'apk': str(Path(apk).resolve()),
    'sha256': digest.hexdigest(),
    'signature': signature.splitlines(),
    'badging': badging.splitlines(),
    'zipAlignment16KB': 'passed',
    'elf64BitAlignment': alignment,
}, indent=2))
