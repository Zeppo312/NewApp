#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';

const DEFAULT_SUPABASE_URL = 'https://kwniiyayhzgjfqjsjcfu.supabase.co';
const DEFAULT_MODEL = 'gpt-5.6-terra';
const DEFAULT_BATCH_SIZE = 25;
const TARGET_LOCALES = ['en', 'es'];
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const TRANSLATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          en: {
            type: 'object',
            additionalProperties: false,
            properties: {
              meaning: { type: 'string' },
              origin: { type: 'string' },
            },
            required: ['meaning', 'origin'],
          },
          es: {
            type: 'object',
            additionalProperties: false,
            properties: {
              meaning: { type: 'string' },
              origin: { type: 'string' },
            },
            required: ['meaning', 'origin'],
          },
        },
        required: ['id', 'en', 'es'],
      },
    },
  },
  required: ['translations'],
};

const INSTRUCTIONS = `Translate German baby-name metadata into English and Spanish.

Completion requirements:
- Translate only the supplied meaning and origin. Never add, correct, research, or infer etymology.
- The name is context only and must not be translated.
- Preserve ambiguity, comma-separated alternatives, punctuation, and tone.
- Return an empty string when the corresponding German source field is empty.
- Return every input id exactly once and do not return ids that were not supplied.
- Keep translations concise and natural for a baby-name discovery app.`;

export const parseArgs = (argv) => {
  const options = {
    batchSize: DEFAULT_BATCH_SIZE,
    dryRun: false,
    force: false,
    limit: null,
    model: process.env.OPENAI_TRANSLATION_MODEL || DEFAULT_MODEL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--limit' && nextValue) {
      options.limit = Number.parseInt(nextValue, 10);
      index += 1;
    } else if (arg.startsWith('--limit=')) options.limit = Number.parseInt(arg.slice(8), 10);
    else if (arg === '--batch-size' && nextValue) {
      options.batchSize = Number.parseInt(nextValue, 10);
      index += 1;
    } else if (arg.startsWith('--batch-size=')) options.batchSize = Number.parseInt(arg.slice(13), 10);
    else if (arg === '--model' && nextValue) {
      options.model = nextValue;
      index += 1;
    } else if (arg.startsWith('--model=')) options.model = arg.slice(8);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 50) {
    throw new Error('--batch-size must be an integer between 1 and 50.');
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer.');
  }
  if (!options.model.trim()) throw new Error('--model must not be empty.');
  return options;
};

const printHelp = () => {
  console.log(`Translate missing or stale baby-name metadata.

Required environment variables:
  SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY
  OPENAI_API_KEY (not required with --dry-run)

Optional environment variables:
  SUPABASE_URL             Defaults to the LottiBaby project URL
  OPENAI_TRANSLATION_MODEL Defaults to ${DEFAULT_MODEL}

Options:
  --dry-run                Count pending names without calling OpenAI or writing
  --force                  Regenerate translations even when they are current
  --limit N                Process at most N source names
  --batch-size N           Translate 1-50 names per request (default ${DEFAULT_BATCH_SIZE})
  --model MODEL            Override the OpenAI model
  --help                   Show this help`);
};

const sourceValue = (value) => (typeof value === 'string' ? value : '');

export const isTranslationFresh = (translation, babyName) =>
  Boolean(translation) &&
  sourceValue(translation.source_meaning) === sourceValue(babyName.meaning) &&
  sourceValue(translation.source_origin) === sourceValue(babyName.origin);

const extractResponseText = (response) => {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }

  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === 'refusal') {
        throw new Error(`OpenAI refused the translation request: ${content.refusal || 'unknown reason'}`);
      }
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }
  throw new Error('OpenAI response did not contain output text.');
};

export const parseTranslationResponse = (response, expectedNames) => {
  const parsed = JSON.parse(extractResponseText(response));
  if (!Array.isArray(parsed?.translations)) {
    throw new Error('OpenAI response is missing translations.');
  }

  const expectedIds = new Set(expectedNames.map((entry) => entry.id));
  const seenIds = new Set();
  const translations = new Map();

  for (const entry of parsed.translations) {
    if (!expectedIds.has(entry?.id)) throw new Error(`OpenAI returned an unknown id: ${entry?.id}`);
    if (seenIds.has(entry.id)) throw new Error(`OpenAI returned id twice: ${entry.id}`);
    seenIds.add(entry.id);

    for (const locale of TARGET_LOCALES) {
      if (typeof entry?.[locale]?.meaning !== 'string' || typeof entry?.[locale]?.origin !== 'string') {
        throw new Error(`OpenAI returned invalid ${locale} fields for id ${entry.id}.`);
      }
    }

    translations.set(entry.id, {
      en: {
        meaning: entry.en.meaning.trim(),
        origin: entry.en.origin.trim(),
      },
      es: {
        meaning: entry.es.meaning.trim(),
        origin: entry.es.origin.trim(),
      },
    });
  }

  const missingIds = [...expectedIds].filter((id) => !seenIds.has(id));
  if (missingIds.length > 0) throw new Error(`OpenAI omitted ids: ${missingIds.join(', ')}`);
  return translations;
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const translateBatch = async ({ apiKey, babyNames, model }) => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          reasoning: { effort: 'none' },
          instructions: INSTRUCTIONS,
          input: JSON.stringify(
            babyNames.map(({ id, name, meaning, origin }) => ({ id, name, meaning, origin })),
          ),
          max_output_tokens: 12_000,
          text: {
            format: {
              type: 'json_schema',
              name: 'baby_name_translation_batch',
              strict: true,
              schema: TRANSLATION_SCHEMA,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const retryable = response.status === 429 || response.status >= 500;
        const error = new Error(`OpenAI API ${response.status}: ${errorBody.slice(0, 800)}`);
        if (!retryable || attempt === 3) throw error;
        lastError = error;
      } else {
        return parseTranslationResponse(await response.json(), babyNames);
      }
    } catch (error) {
      lastError = error;
      if (attempt === 3 || (error?.name !== 'AbortError' && !String(error?.message).startsWith('OpenAI API 429') && !/OpenAI API 5\d\d/.test(String(error?.message)))) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
    await delay(2 ** attempt * 1_000);
  }
  throw lastError;
};

const fetchBabyNames = async (supabase, limit) => {
  const names = [];
  const pageSize = 1_000;
  while (limit === null || names.length < limit) {
    const requested = limit === null ? pageSize : Math.min(pageSize, limit - names.length);
    const from = names.length;
    const { data, error } = await supabase
      .from('baby_names')
      .select('id, name, meaning, origin')
      .order('id', { ascending: true })
      .range(from, from + requested - 1);
    if (error) throw new Error(`Could not load baby_names: ${error.message}`);
    names.push(...(data ?? []));
    if (!data || data.length < requested) break;
  }
  return names;
};

const fetchExistingTranslations = async (supabase, babyNameIds) => {
  const { data, error } = await supabase
    .from('baby_name_translations')
    .select('baby_name_id, locale, source_meaning, source_origin')
    .in('baby_name_id', babyNameIds);
  if (error) throw new Error(`Could not load baby_name_translations: ${error.message}`);
  return data ?? [];
};

const buildUpsertRows = ({ babyNames, translations, model }) => {
  const now = new Date().toISOString();
  return babyNames.flatMap((babyName) =>
    TARGET_LOCALES.map((locale) => ({
      baby_name_id: babyName.id,
      locale,
      meaning: translations.get(babyName.id)[locale].meaning || null,
      origin: translations.get(babyName.id)[locale].origin || null,
      source_meaning: babyName.meaning ?? null,
      source_origin: babyName.origin ?? null,
      provider: 'openai',
      model,
      updated_at: now,
    })),
  );
};

const run = async (options) => {
  const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (!supabaseKey) {
    throw new Error('Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY before running the script.');
  }
  if (!options.dryRun && !openAiKey) {
    throw new Error('Set OPENAI_API_KEY before running translations.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const babyNames = await fetchBabyNames(supabase, options.limit);
  console.log(`Loaded ${babyNames.length} baby names.`);

  let pendingCount = 0;
  let translatedCount = 0;
  for (let offset = 0; offset < babyNames.length; offset += options.batchSize) {
    const sourceBatch = babyNames.slice(offset, offset + options.batchSize);
    const existing = await fetchExistingTranslations(supabase, sourceBatch.map((entry) => entry.id));
    const byNameAndLocale = new Map(
      existing.map((entry) => [`${entry.baby_name_id}:${entry.locale}`, entry]),
    );
    const pending = sourceBatch.filter((babyName) =>
      options.force || TARGET_LOCALES.some((locale) =>
        !isTranslationFresh(byNameAndLocale.get(`${babyName.id}:${locale}`), babyName),
      ),
    );
    pendingCount += pending.length;

    if (options.dryRun || pending.length === 0) {
      console.log(`[${Math.min(offset + sourceBatch.length, babyNames.length)}/${babyNames.length}] ${pending.length} pending`);
      continue;
    }

    const translations = await translateBatch({ apiKey: openAiKey, babyNames: pending, model: options.model });
    const rows = buildUpsertRows({ babyNames: pending, translations, model: options.model });
    const { error } = await supabase
      .from('baby_name_translations')
      .upsert(rows, { onConflict: 'baby_name_id,locale' });
    if (error) throw new Error(`Could not save translations: ${error.message}`);

    translatedCount += pending.length;
    console.log(`[${Math.min(offset + sourceBatch.length, babyNames.length)}/${babyNames.length}] translated ${pending.length}; total ${translatedCount}`);
  }

  if (options.dryRun) console.log(`Dry run complete: ${pendingCount} names need translation.`);
  else console.log(`Done: translated ${translatedCount} names (${translatedCount * TARGET_LOCALES.length} localized rows).`);
};

const main = async () => {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }
    await run(options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

