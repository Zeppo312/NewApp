// Aggregate-only SMTP relay. Credentials come from the process environment.
// --test sends explicitly synthetic positive counters; --dry-run never sends.
import { collectDeletionStatus } from './account-deletion-check.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export function composeDeletionAlarm(report, test = false) {
  if (report.alerts === null) report = { ...report, checkFailed: true };
  const counts = Object.entries(report.alerts ?? {}).filter(([, value]) => value > 0);
  if (!test && !report.checkFailed && counts.length === 0) return null;
  const subject = `${test ? '[TEST] ' : ''}Lotti Löschbetrieb: ${report.checkFailed ? 'Statusprüfung fehlgeschlagen' : 'Bearbeitung erforderlich'} (${report.environment})`;
  const text = [test ? 'Synthetischer Transporttest. Keine echten Löschaufträge betroffen.' : 'Bitte den geschützten Löschstatus prüfen und die Bearbeitung übernehmen.',
    `Prüfzeit: ${report.checkedAt}`, `Umgebung: ${report.environment}`, ...counts.map(([key, value]) => `${key}: ${value}`),
    report.checkFailed ? 'Der Backend-Status konnte nicht verlässlich gelesen werden.' : '',
    'Hauptverantwortlich: Jan Zeppenfeld. Vertretung: Ehefrau nach ausdrücklicher Übergabe.',
    'Keine Kontokennung oder personenbezogenen Inhalte sind in dieser Nachricht enthalten.',
    test ? 'Bitte den tatsächlichen Empfang dieses Tests bestätigen.' : 'Vorgehen: docs/privacy/deletion-support-and-alerts.md'].filter(Boolean).join('\n');
  return { to: 'support@lottibaby.de', subject, text };
}
async function main() {
  const args = process.argv.slice(2); let environment; let stateFile; let test = false; let dryRun = false;
  if (args.length === 1 && args[0] === '--help') { console.log('node scripts/account-deletion-alert.mjs --environment qa|production [--test] [--dry-run] [--state private-state.json]\nSMTP_HOST=smtp.hostinger.com SMTP_PORT=465 SMTP_USER and SMTP_PASSWORD required for sending. Recipient: support@lottibaby.de.'); return; }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--environment' && ['qa', 'production'].includes(args[i + 1])) environment = args[++i];
    else if (args[i] === '--state' && args[i + 1]) stateFile = resolve(args[++i]);
    else if (args[i] === '--test') test = true;
    else if (args[i] === '--dry-run') dryRun = true;
    else throw new Error('Invalid arguments.');
  }
  if (!environment) throw new Error('Explicit environment required.');
  let report;
  if (test) report = { environment, checkedAt: new Date().toISOString(), alerts: { needs_attention: 1, overdue_retention: 1, lease_exceeds_contract: 1 } };
  else { try { report = await collectDeletionStatus(environment); } catch { report = { environment, checkedAt: new Date().toISOString(), checkFailed: true }; } }
  const message = composeDeletionAlarm(report, test);
  if (!message) { if (stateFile && !dryRun) { await mkdir(dirname(stateFile), {recursive:true}); await writeFile(stateFile, '{}\n', {mode:0o600}); } console.log('No actionable alarm.'); return; }
  if (dryRun) { console.log(JSON.stringify(message, null, 2)); return; }
  const signature = createHash('sha256').update(JSON.stringify({environment, alerts:report.alerts, failed:report.checkFailed})).digest('hex');
  if (stateFile && !test) {
    let prior; try { prior = JSON.parse(await readFile(stateFile,'utf8')); } catch(error) { if (error.code !== 'ENOENT') throw error; }
    if (prior?.signature === signature && Date.now() - Date.parse(prior.sentAt) < 3600000) { console.log('Unchanged alarm already relayed within the last hour.'); return; }
  }
  if (process.env.SMTP_HOST !== 'smtp.hostinger.com' || !['465', '587'].includes(process.env.SMTP_PORT || '465') || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) throw new Error('SMTP configuration missing.');
  await new Promise((ok, fail) => {
    const child = spawn('python3', ['scripts/send-deletion-alarm.py'], { stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.end(JSON.stringify(message)); child.on('error', fail);
    child.on('exit', code => code === 0 ? ok() : fail(new Error('SMTP relay failed.')));
    // Never forward raw transport output, which may contain private server details.
    child.stdout.resume(); child.stderr.resume();
  });
  if (stateFile && !test) { await mkdir(dirname(stateFile), {recursive:true}); await writeFile(stateFile, JSON.stringify({signature,sentAt:new Date().toISOString()}),{mode:0o600}); }
  console.log('SMTP accepted the aggregate alarm. Actual inbox receipt still requires verification.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { console.error('Alarm relay could not complete; inspect private SMTP configuration. No credentials logged.'); process.exitCode = 1; });
