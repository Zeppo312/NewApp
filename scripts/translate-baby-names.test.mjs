import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isTranslationFresh,
  parseArgs,
  parseTranslationResponse,
} from './translate-baby-names.mjs';

test('parseArgs validates and reads batch options', () => {
  assert.deepEqual(parseArgs(['--dry-run', '--batch-size=10', '--limit', '30']).batchSize, 10);
  assert.throws(() => parseArgs(['--batch-size=51']), /between 1 and 50/);
});

test('isTranslationFresh compares the German source fields', () => {
  const name = { meaning: 'Die Geliebte', origin: 'Slawisch' };
  assert.equal(isTranslationFresh({ source_meaning: 'Die Geliebte', source_origin: 'Slawisch' }, name), true);
  assert.equal(isTranslationFresh({ source_meaning: 'Geliebt', source_origin: 'Slawisch' }, name), false);
});

test('parseTranslationResponse accepts exact structured output', () => {
  const response = {
    output: [{
      content: [{
        type: 'output_text',
        text: JSON.stringify({
          translations: [{
            id: '1',
            en: { meaning: 'The beloved one', origin: 'Slavic' },
            es: { meaning: 'La amada', origin: 'Eslavo' },
          }],
        }),
      }],
    }],
  };
  const result = parseTranslationResponse(response, [{ id: '1' }]);
  assert.equal(result.get('1').en.origin, 'Slavic');
  assert.equal(result.get('1').es.meaning, 'La amada');
});

test('parseTranslationResponse rejects omitted ids', () => {
  const response = { output_text: JSON.stringify({ translations: [] }) };
  assert.throws(() => parseTranslationResponse(response, [{ id: '1' }]), /omitted ids/);
});

