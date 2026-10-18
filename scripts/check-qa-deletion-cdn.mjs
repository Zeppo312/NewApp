// Read-only repeat probe for the synthetic object created during Auftrag 7.
// The private URL is never printed. No cache busting: query the warmed URL.
import { readFile, writeFile } from 'node:fs/promises';
const privatePath = new URL('../.family-qa/acceptance-20260928/cdn-url.json', import.meta.url);
const reportPath = new URL('../output/restabnahme-20260928/cdn-expiry.json', import.meta.url);
const target = JSON.parse(await readFile(privatePath, 'utf8'));
const url = new URL(target.url);
if (url.origin !== 'https://ggyonianphloycmqrwvj.supabase.co' ||
    !url.pathname.startsWith('/storage/v1/object/public/public-images/qa-delete-20260928/') || url.search) {
  throw new Error('Expected the original synthetic QA object URL');
}
const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
let body; try { body = await response.json(); } catch {}
const missingObject = response.status === 404 || (response.status === 400 && String(body?.statusCode) === '404' && body?.error === 'not_found');
const check = { missingObject, at: new Date().toISOString(), status: response.status,
  secondsAfterDeletion: Math.floor((Date.now() - Date.parse(target.deletedAt)) / 1000),
  cacheControl: response.headers.get('cache-control'), cacheStatus: response.headers.get('cf-cache-status') };
const report = JSON.parse(await readFile(reportPath, 'utf8'));
report.checks.push(check);
report.status = response.status === 200 ? 'pending_expiry' : missingObject ? 'unavailable_observed' : 'inconclusive';
report.limit = 'One QA URL and observed CDN path only; no guaranteed global upper bound.';
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(check));
