require('dotenv').config({ quiet: true });
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { adminToken } = require('./helpers');

let agent, districtId;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  agent = request.agent(app).set('Authorization', `Bearer ${await adminToken()}`);
  const provinces = (await agent.get('/provinces')).body.data;
  const western = provinces.find((p) => p.name === 'Western');
  const districts = (await agent.get(`/provinces/${western.id}/districts`)).body.data;
  districtId = districts.find((d) => d.name === 'Colombo').id;
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('district generation summary', () => {
  test('has the expected shape', async () => {
    const res = await agent.get(`/districts/${districtId}/generation-summary`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        districtId,
        districtName: 'Colombo',
        currentPowerKw: expect.any(Number),
        todayEnergyKwh: expect.any(Number),
        installations: { total: expect.any(Number), reporting: expect.any(Number) },
      })
    );
    expect(res.body.currentPowerKw).toBeGreaterThanOrEqual(0);
    expect(res.body.todayEnergyKwh).toBeGreaterThanOrEqual(0);
    expect(res.body.installations.reporting).toBeLessThanOrEqual(res.body.installations.total);
  });

  test('currentPowerKw equals the sum of each installation last-reading', async () => {
    const summary = (await agent.get(`/districts/${districtId}/generation-summary`)).body;
    const list = (await agent.get(`/installations?district=${districtId}&limit=100`)).body;
    expect(list.total).toBe(summary.installations.total);

    let sum = 0;
    for (const inst of list.data) {
      const last = await agent.get(`/installations/${inst.id}/last-reading`);
      if (last.status === 200) sum += last.body.powerKw;
    }
    expect(summary.currentPowerKw).toBeCloseTo(sum, 2);
  });

  test("todayEnergyKwh is a counter difference, not a sum of lifetime values", async () => {
    const summary = (await agent.get(`/districts/${districtId}/generation-summary`)).body;
    // A district of ~25 installations generates tens to a few thousand kWh per day;
    // summing lifetime counters (500-20000 kWh each) would be far larger.
    expect(summary.todayEnergyKwh).toBeLessThan(summary.installedCapacityKw * 24);
  });

  test('unknown district is 404, malformed id is 400', async () => {
    expect((await agent.get('/districts/000000000000000000000000/generation-summary')).status).toBe(404);
    expect((await agent.get('/districts/abc/generation-summary')).status).toBe(400);
  });

  test('supports conditional GET (304, empty body)', async () => {
    const url = `/districts/${districtId}/generation-summary`;
    const first = await agent.get(url);
    expect(first.headers.etag).toBeDefined();
    expect(first.headers['last-modified']).toBeDefined();
    const second = await agent.get(url).set('If-None-Match', first.headers.etag);
    expect(second.status).toBe(304);
    expect(second.text).toBe('');
  });

  test('wrong method is 405', async () => {
    const res = await agent.post(`/districts/${districtId}/generation-summary`).send({});
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe('GET');
  });
});