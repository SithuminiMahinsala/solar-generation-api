require('dotenv').config({ quiet: true });
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { adminToken } = require('./helpers');

let agent;
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  agent = request.agent(app).set('Authorization', `Bearer ${await adminToken()}`);
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('hierarchy read path', () => {
  test('GET /provinces returns 9 provinces', async () => {
    const res = await agent.get('/provinces');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(9);
  });

  test('provinces include ETag and Last-Modified headers', async () => {
    const res = await agent.get('/provinces');
    expect(res.headers.etag).toBeDefined();
    expect(res.headers['last-modified']).toBeDefined();
  });

  test('conditional GET returns 304 with empty body (If-None-Match)', async () => {
    const first = await agent.get('/provinces');
    const second = await agent
      .get('/provinces')
      .set('If-None-Match', first.headers.etag);
    expect(second.status).toBe(304);
    expect(second.text).toBe('');
  });

  test('conditional GET returns 304 with empty body (If-Modified-Since)', async () => {
    const first = await agent.get('/provinces');
    const second = await agent
      .get('/provinces')
      .set('If-Modified-Since', first.headers['last-modified']);
    expect(second.status).toBe(304);
    expect(second.text).toBe('');
  });

  test('stale ETag returns 200 with full body', async () => {
    const res = await agent.get('/provinces').set('If-None-Match', '"stale"');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(9);
  });
});

describe('installations and readings', () => {
  let installationId;

  beforeAll(async () => {
    const res = await agent.get('/installations?limit=1');
    installationId = res.body.data[0].id;
  });

  test('installation list is paginated with next link', async () => {
    const res = await agent.get('/installations?limit=20');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(240);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.links.next).toEqual(expect.any(String));
    expect(res.body.links.prev).toBeNull();
  });

  test('no secrets in installation responses', async () => {
    const res = await agent.get(`/installations/${installationId}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/deviceSecret|passwordHash/);
  });

  test('composite detail contains related resources', async () => {
    const res = await agent.get(`/installations/${installationId}/detail`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        substation: expect.any(Object),
        district: expect.any(Object),
        province: expect.any(Object),
        lastReading: expect.any(Object),
      })
    );
  });

  test('last-reading is the newest reading', async () => {
    const last = await agent.get(`/installations/${installationId}/last-reading`);
    const newest = await agent.get(
      `/installations/${installationId}/readings?sort=-timestamp&limit=1`
    );
    expect(last.status).toBe(200);
    expect(last.body.id).toBe(newest.body.data[0].id);
  });

  test('readings: pagination count and links', async () => {
    const res = await agent.get(`/installations/${installationId}/readings?limit=100`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(672);
    expect(res.body.data).toHaveLength(100);
    expect(res.body.links.next).not.toBeNull();
    expect(res.body.links.prev).toBeNull();
  });

  test('readings: sorting ascending and descending', async () => {
    const asc = await agent.get(`/installations/${installationId}/readings?sort=timestamp&limit=5`);
    const desc = await agent.get(`/installations/${installationId}/readings?sort=-timestamp&limit=5`);
    const a = asc.body.data.map((r) => new Date(r.timestamp).getTime());
    const d = desc.body.data.map((r) => new Date(r.timestamp).getTime());
    expect(a).toEqual([...a].sort((x, y) => x - y));
    expect(d).toEqual([...d].sort((x, y) => y - x));
    expect(a[0]).toBeLessThan(d[0]);
  });

  test('readings: time window filter', async () => {
    const newest = await agent.get(`/installations/${installationId}/last-reading`);
    const to = new Date(newest.body.timestamp);
    const from = new Date(to.getTime() - 60 * 60 * 1000); // last hour
    const res = await agent.get(
      `/installations/${installationId}/readings?from=${from.toISOString()}&to=${to.toISOString()}&limit=100`
    );
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    res.body.data.forEach((r) => {
      const t = new Date(r.timestamp).getTime();
      expect(t).toBeGreaterThanOrEqual(from.getTime());
      expect(t).toBeLessThanOrEqual(to.getTime());
    });
  });

  test('readings: reversed time window is 400', async () => {
    const res = await agent.get(
      `/installations/${installationId}/readings?from=2026-10-10&to=2026-10-01`
    );
    expect(res.status).toBe(400);
  });

test('readings: conditional GET returns 304', async () => {
  const url = `/installations/${installationId}/readings`;
  // Pin Host: supertest uses a random port per request, and links in the body contain the host
  const first = await agent.get(url).set('Host', 'api.test');
  expect(first.headers.etag).toBeDefined();

  const second = await agent
    .get(url)
    .set('Host', 'api.test')
    .set('If-None-Match', first.headers.etag);
  expect(second.status).toBe(304);
  expect(second.text).toBe('');
});

  test('district readings are scoped to that district', async () => {
    const inst = await agent.get(`/installations/${installationId}`);
    const districtId = inst.body.districtId;
    const res = await agent.get(`/districts/${districtId}/readings?limit=50`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
  });

});