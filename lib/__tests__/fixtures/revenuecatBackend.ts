export const USER = '11111111-1111-4111-8111-111111111111';
export const OTHER_USER = '22222222-2222-4222-8222-222222222222';
export const SHARED = 'entl7a7b4e9838';
export const config = { premium: 'ent-premium', standard: 'ent-standard', lite: 'ent-lite' };
export const list = (items: unknown[], next_page: string | null = null) => ({ items, next_page });
export const future = () => Date.now() + 3_600_000;
export const paid = (overrides = {}) => ({
  id: 'sub-paid', product_id: 'prod-paid', gives_access: true, store: 'play_store',
  ends_at: future(), entitlements: list([{ id: SHARED }]), ...overrides,
});

// Stateful PostgREST double: executes filters at mutation time, models unique
// constraints/ignoreDuplicates, row counts, and exact checked_at compare-and-set.
export function backendDb() {
  const tables: Record<string, Map<string, any>> = {
    lotti_subscription_entitlements: new Map(), lotti_revenuecat_webhook_events: new Map(),
    profiles: new Map([[USER, {}]]), subscription_plan_features: new Map(),
  };
  const failures: Record<string, number> = {};
  const users = new Set([USER, OTHER_USER]);
  const db = {
    rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
    tables, failures, users,
    auth: { admin: { getUserById: jest.fn(async (id: string) => users.has(id)
      ? { data: { user: { id } }, error: null }
      : { data: null, error: { status: 404, code: 'user_not_found' } }) } },
    from: jest.fn((table: string) => {
      let operation = 'read'; let row: any; let options: any;
      let returning = false; let single = false;
      const filters: Record<string, any> = {};
      const query: any = {
        select: () => { returning = true; return query; },
        eq: (key: string, value: any) => { filters[key] = value; return query; },
        maybeSingle: () => { single = true; return query; },
        upsert: (value: any, opts: any) => { operation = 'insert'; row = value; options = opts; return query; },
        update: (value: any) => { operation = 'update'; row = value; return query; },
        then: (resolve: any, reject: any) => Promise.resolve().then(() => {
          const key = `${table}:${operation}`;
          if (failures[key]) { failures[key]--; return { data: null, error: { message: 'injected failure' } }; }
          const values = tables[table];
          if (!values) throw new Error(`Unknown table ${table}`);
          const matches = [...values.values()].filter(value => Object.entries(filters).every(([k, v]) => value[k] === v));
          let rows = matches;
          if (operation === 'insert') {
            const id = row.user_id ?? row.event_id;
            if (values.has(id) && options?.ignoreDuplicates) rows = [];
            else { values.set(id, { ...row }); rows = [row]; }
          }
          if (operation === 'update') {
            rows = matches.map(value => {
              const next = { ...value, ...row };
              values.set(value.user_id ?? value.event_id, next);
              return next;
            });
          }
          return { error: null, data: !returning ? null : single ? rows[0] ?? null : rows };
        }).then(resolve, reject),
      };
      return query;
    }),
  };
  return db;
}
