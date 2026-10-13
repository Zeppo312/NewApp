// Always creates a disposable local database. Never reads a production URL.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';

export async function createFamilyTestDb(modulePath, native = false) {
  const module = await import(pathToFileURL(resolve(modulePath)).href);
  if (!native) {
    const db = new module.PGlite();
    db.parallelQueries = queries => Promise.all(queries.map(query => db.query(query)));
    return db;
  }
  const socket = createServer();
  await new Promise((ok, fail) => { socket.once('error', fail); socket.listen(0, '127.0.0.1', ok); });
  const port = socket.address().port;
  await new Promise(ok => socket.close(ok));
  const directory = await mkdtemp(join(tmpdir(), 'lotti-family-pg-'));
  const postgres = new module.default({
    databaseDir: join(directory, 'data'), user: 'postgres', password: randomUUID(),
    port, persistent: false,
    postgresFlags: ['-h', '127.0.0.1', '-k', directory, '-c', 'statement_timeout=15000'],
    onLog: () => {}, onError: () => {},
  });
  let client;
  try {
    await postgres.initialise();
    await postgres.start();
    client = postgres.getPgClient('postgres', '127.0.0.1');
    await client.connect();
  } catch (error) {
    await client?.end();
    await postgres.stop().catch(() => {});
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return {
    exec: sql => client.query(sql),
    query: sql => client.query(sql),
    // Connect all clients before issuing requests so the burst overlaps.
    async parallelQueries(queries) {
      const clients = queries.map(() => postgres.getPgClient('postgres', '127.0.0.1'));
      try {
        await Promise.all(clients.map(connection => connection.connect()));
        return await Promise.all(clients.map((connection, i) => connection.query(queries[i])));
      } finally {
        await Promise.all(clients.map(connection => connection.end()));
      }
    },
    async close() {
      await client.end();
      await postgres.stop();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
