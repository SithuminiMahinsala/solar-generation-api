require('dotenv').config({ quiet: true });
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../src/app');
const { login, adminToken, PASSWORD } = require('./helpers');

const as = (token) => request.agent(app).set('Authorization', `Bearer ${token}`);
const creds = (email) => ({ email, password: PASSWORD() });

let admin, colombo, western, colomboId, gampahaId, kandyId, centralId;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  admin = as(await adminToken());

  const c = await login(creds('colombo.district@slsea.lk'));
  colombo = as(c.access_token);
  colomboId = c.jurisdiction.id;

  gampahaId = (await login(creds('gampaha.district@slsea.lk'))).jurisdiction.id;
  western = as((await login(creds('western.province@slsea.lk'))).access_token);

  const provinces = (await admin.get('/provinces')).body.data;
  centralId = provinces.find((p) => p.name === 'Central').id;
  const districts = (await admin.get(`/provinces/${centralId}/districts`)).body.data;
  kandyId = districts.find((d) => d.name === 'Kandy').id;
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('authentication (401)', () => {
  test('no token', async () => {
    const res = await request(app).get('/provinces');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
    expect(res.headers['www-authenticate']).toMatch(/Bearer/);
  });

  test('garbage token', async () => {
    expect((await as('not.a.token').get('/provinces')).status).toBe(401);
  });

  test('token signed with a different secret', async () => {
    const forged = jwt.sign(
      { kind: 'user', scope: 'analyst:read admin:write', jurisdictionLevel: 'national' },
      'x'.repeat(40),
      { subject: 'attacker', issuer: 'slsea-solar-api', audience: 'slsea-solar-api' }
    );
    expect((await as(forged).get('/provinces')).status).toBe(401);
  });

  test('expired token', async () => {
    const expired = jwt.sign(
      { kind: 'user', scope: 'analyst:read', jurisdictionLevel: 'national' },
      process.env.JWT_SECRET,
      { subject: 'someone', issuer: 'slsea-solar-api', audience: 'slsea-solar-api', expiresIn: -10 }
    );
    expect((await as(expired).get('/provinces')).status).toBe(401);
  });

  test('wrong password and unknown email give the same response', async () => {
    const a = await request(app).post('/tokens').send({ email: 'admin@slsea.lk', password: 'wrong' });
    const b = await request(app).post('/tokens').send({ email: 'nobody@slsea.lk', password: 'wrong' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });

  test('token request mixing device and user credentials is 400', async () => {
    const res = await request(app).post('/tokens')
      .send({ meterId: 'X-1', deviceSecret: 'y', email: 'admin@slsea.lk', password: 'z' });
    expect(res.status).toBe(400);
  });

  test('operator injection in login is rejected', async () => {
    const res = await request(app).post('/tokens')
      .send({ email: { $ne: '' }, password: { $ne: '' } });
    expect(res.status).toBe(400);
  });
});

describe('district analyst: jurisdiction scope', () => {
  test('own district is readable', async () => {
    expect((await colombo.get(`/districts/${colomboId}`)).status).toBe(200);
    expect((await colombo.get(`/districts/${colomboId}/readings?limit=5`)).status).toBe(200);
  });

  test('another district is 403 (record and readings)', async () => {
    for (const url of [`/districts/${gampahaId}`, `/districts/${gampahaId}/readings`,
                       `/districts/${gampahaId}/substations`, `/districts/${kandyId}`]) {
      const res = await colombo.get(url);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    }
  });

  test('provinces are not visible', async () => {
    expect((await colombo.get('/provinces')).body.total).toBe(0);
    expect((await colombo.get(`/provinces/${centralId}`)).status).toBe(403);
  });

  test('installation list contains only own district', async () => {
    const res = await colombo.get('/installations?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    res.body.data.forEach((i) => expect(i.districtId).toBe(colomboId));
  });

  test('filter parameter cannot widen the scope', async () => {
    const res = await colombo.get(`/installations?district=${gampahaId}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  test('an installation in another district is 403', async () => {
    const other = (await admin.get(`/installations?district=${gampahaId}&limit=1`)).body.data[0];
    expect((await colombo.get(`/installations/${other.id}`)).status).toBe(403);
    expect((await colombo.get(`/installations/${other.id}/readings`)).status).toBe(403);
    expect((await colombo.get(`/installations/${other.id}/last-reading`)).status).toBe(403);
  });

  test('composite hides the province from a district user', async () => {
    const own = (await colombo.get('/installations?limit=1')).body.data[0];
    const res = await colombo.get(`/installations/${own.id}/detail`);
    expect(res.status).toBe(200);
    expect(res.body.province).toBeNull();
  });

  test('analysts cannot write anything', async () => {
    const own = (await colombo.get('/installations?limit=1')).body.data[0];
    const reading = { timestamp: new Date().toISOString(), powerKw: 1, energyKwh: 1, voltage: 230 };
    expect((await colombo.post(`/installations/${own.id}/readings`).send(reading)).status).toBe(403);
    expect((await colombo.post('/installations').send({})).status).toBe(403);
    expect((await colombo.delete(`/installations/${own.id}`)).status).toBe(403);
  });
});

describe('province analyst', () => {
  test('sees only own province', async () => {
    const res = await western.get('/provinces');
    expect(res.body.total).toBe(1);
  });

  test('can read districts inside, not outside', async () => {
    expect((await western.get(`/districts/${colomboId}`)).status).toBe(200);
    expect((await western.get(`/districts/${gampahaId}`)).status).toBe(200);
    expect((await western.get(`/districts/${kandyId}`)).status).toBe(403);
    expect((await western.get(`/provinces/${centralId}/readings`)).status).toBe(403);
  });
});

describe('device: write-only, own installation only', () => {
  test('full device lifecycle', async () => {
    const [a, b] = (await admin.get('/installations?limit=2')).body.data;
    const meterId = `SLSEA-T-${Date.now()}`;
    const created = await admin.post('/installations').send({
      name: 'Auth Test Rooftop', meterId, capacityKw: 5,
      installDate: '2026-01-01', substationId: a.substationId,
    });
    expect(created.status).toBe(201);
    const { id, deviceSecret } = created.body;

    try {
      const tokenRes = await login({ meterId, deviceSecret });
      expect(tokenRes.scope).toBe('installation:write');
      const device = as(tokenRes.access_token);

      const body = { timestamp: new Date(Date.now() - 60000).toISOString(),
                     powerKw: 1, energyKwh: 10, voltage: 230 };

      const ok = await device.post(`/installations/${id}/readings`).send(body);
      expect(ok.status).toBe(201);
      expect(ok.headers.location).toContain(`/installations/${id}/readings/${ok.body.id}`);

      // another installation: forbidden
      expect((await device.post(`/installations/${b.id}/readings`).send(body)).status).toBe(403);

      // devices cannot read anything
      expect((await device.get('/provinces')).status).toBe(403);
      expect((await device.get(`/installations/${id}`)).status).toBe(403);
      expect((await device.get(`/installations/${id}/readings`)).status).toBe(403);

      // devices cannot administer installations or delete readings
      expect((await device.delete(`/installations/${id}`)).status).toBe(403);
      expect((await device.delete(`/installations/${id}/readings/${ok.body.id}`)).status).toBe(403);

      await admin.delete(`/installations/${id}/readings/${ok.body.id}`).expect(204);
    } finally {
      await admin.delete(`/installations/${id}`); // clean up the test installation
    }
  });

  test('wrong device secret is 401', async () => {
    const res = await request(app).post('/tokens')
      .send({ meterId: 'SLSEA-M-00001', deviceSecret: 'wrong' });
    expect(res.status).toBe(401);
  });
});