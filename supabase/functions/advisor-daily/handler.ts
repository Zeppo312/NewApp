/** Retired endpoint: even old schedulers and force requests perform no work.
 * Keep this response until every deployed schedule has been removed. */
export function handleDisabledAdvisorDaily(_req: Request): Response {
  return new Response(JSON.stringify({ disabled: true, processed: 0, reason: 'foreground_only' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
