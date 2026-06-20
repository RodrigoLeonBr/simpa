import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import mockDb from '../../mock/db.json';
import { fetchDashboard } from './dashboard';

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url?.startsWith('/api/v1/dashboard/planejamento')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockDb.planejamento[0]));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err?: Error) => (err ? reject(err) : resolve()));
  });
});

describe('fetchDashboard integration', () => {
  it('returns 200 and ContratoDashboard payload from mock server', async () => {
    const originalBase = import.meta.env.VITE_API_BASE;
    import.meta.env.VITE_API_BASE = baseUrl;

    try {
      const payload = await fetchDashboard('2026-05');
      expect(payload.versao_schema).toBe('3.1.0');
      expect(payload.indicadores_qualidade.length).toBeGreaterThan(0);
    } finally {
      import.meta.env.VITE_API_BASE = originalBase;
    }
  });
});
