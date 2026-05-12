import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp({ silent: true });

describe('GET /api/health', () => {
  it('returns ok with uptime', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.data.uptime).toBe('number');
  });
});
