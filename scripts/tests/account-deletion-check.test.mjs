import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assessDeletionStatus } from '../account-deletion-check.mjs';
const fixture = () => ({ metadata: { schema_present: true, worker_present: true, readiness_present: true, access_guard_present: true, access_guard_installed: true, registry_guard_present: true },
  settings: { inventory_current: true, approval_named: true, approval_dated: true, receipt_retention_days: 30, backup_window_days: 10, completed_requests: 0, provider_handling_mode: 'verified_retention', registry_unacknowledged_requests: 0 },
  functions: ['request-account-deletion', 'process-account-deletion'].map(slug => ({ slug, status: 'ACTIVE' })),
  secrets: ['REVENUECAT_DELETION_API_KEY', 'REVENUECAT_PROJECT_ID', 'ACCOUNT_DELETION_CRON_SECRET'].map(name => ({ name })).concat({ name: 'ACCOUNT_DELETION_ENABLED', value: createHash('sha256').update('true').digest('hex') }),
  scheduler: [{ active: true }], health: { needs_attention: 0, queued_over_15m: 0, expired_lease_over_7m: 0, lease_exceeds_contract: 0, overdue_retention: 0, pending_provider_evidence: 3 } });
test('zero requests and zero counters never imply release approval', () => {
  const report = assessDeletionStatus(fixture()); assert.equal(report.configured, true); assert.equal(report.releaseApproved, false); assert.equal(report.alarm, false); assert.equal(report.pendingProviderEvidence, 3);
});
test('disabled runtime and absent dedicated provider key are distinct blockers', () => {
  const input = fixture(); input.secrets = [{ name: 'ACCOUNT_DELETION_ENABLED', value: createHash('sha256').update('false').digest('hex') }, { name: 'REVENUECAT_SECRET_API_KEY' }];
  const report = assessDeletionStatus(input); assert.equal(report.configured, false); assert.ok(report.blockers.includes('deletion_disabled')); assert.ok(report.blockers.includes('revenuecat_deletion_api_key_missing'));
});
test('incomplete approval, guard and inactive schedule block acceptance readiness', () => {
  const input = fixture(); input.metadata.access_guard_installed = false; input.settings.approval_dated = false; input.scheduler = [{ active: false }];
  assert.deepEqual(assessDeletionStatus(input).blockers, ['access_guard_missing', 'inventory_not_approved', 'worker_schedule_inactive']);
});
test('positive signals alarm; ordinary pending provider work is informational', () => {
  const input = fixture(); input.health.overdue_retention = '1'; const report = assessDeletionStatus(input); assert.equal(report.alarm, true); assert.equal(report.alerts.overdue_retention, 1);
});
test('absent backend has unknown health rather than a false healthy zero', () => {
  const report = assessDeletionStatus({ metadata: {}, health: null }); assert.equal(report.alerts, null); assert.equal(report.completedRequests, null); assert.equal(report.configured, false);
});
test('missing or malformed health cannot silently become healthy zeros', () => {
 const input=fixture();input.health.needs_attention='unreadable';const report=assessDeletionStatus(input);
 assert.equal(report.configured,false);assert.equal(report.alerts,null);assert.ok(report.blockers.includes('operational_health_unverified'));
});
test('supervised handling permits an unknown window without claiming external writer verification', () => {
 const input=fixture(); input.settings.provider_handling_mode='supervised'; input.settings.backup_window_days=null;
 const report=assessDeletionStatus(input); assert.equal(report.configured,true); assert.equal(report.releaseApproved,false);
 assert.equal(report.independentRegistry.writerRuntimeVerified,false); assert.equal(report.independentRegistry.durableOperatorPathVerified,false);
 input.settings.provider_handling_mode='verified_retention'; assert.ok(assessDeletionStatus(input).blockers.includes('retention_not_configured'));
 input.settings.provider_handling_mode='unapproved'; assert.ok(assessDeletionStatus(input).blockers.includes('retention_not_configured'));
});
test('a missing registry barrier or unacknowledged jobs cannot be reported ready', () => {
 const input=fixture(); input.metadata.registry_guard_present=false;
 assert.ok(assessDeletionStatus(input).blockers.includes('independent_registry_guard_missing'));
 input.metadata.registry_guard_present=true; input.settings.registry_unacknowledged_requests='2';
 assert.ok(assessDeletionStatus(input).blockers.includes('registry_acknowledgements_pending'));
 input.settings.registry_unacknowledged_requests=undefined;
 assert.ok(assessDeletionStatus(input).blockers.includes('registry_acknowledgements_unverified'));
});
