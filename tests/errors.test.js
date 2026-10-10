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

function expectErrorContract(res, status, code) {
  expect(res.status).toBe(status);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(Object.keys(res.body).sort()).toEqual(['code', 'details', 'message']);
  expect(res.body.code).toBe(code);
  expect(typeof res.body.message).toBe('string');
  expect(Array.isArray(res.body.details)).toBe(true);
}

const ZERO_ID = '000000000000000000000000';



describe('error contract', () => {
  test('400 malformed id', async () => {
    expectErrorContract(await request(app).get('/installations/abc'), 400, 'VALIDATION_ERROR');
  });

  test('400 unknown query parameter', async () => {
    expectErrorContract(await request(app).get('/installations?distrct=x'), 400, 'VALIDATION_ERROR');
  });

  test('400 malformed JSON', async () => {
    const res = await request(app)
      .post('/installations')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expectErrorContract(res, 400, 'VALIDATION_ERROR');
  });

  test('404 unknown resource', async () => {
    expectErrorContract(await request(app).get(`/installations/${ZERO_ID}`), 404, 'RESOURCE_NOT_FOUND');
  });

  test('404 unknown route', async () => {
    expectErrorContract(await request(app).get('/nonsense'), 404, 'RESOURCE_NOT_FOUND');
  });

  test('405 with Allow header', async () => {
    const res = await request(app).delete('/provinces');
    expectErrorContract(res, 405, 'METHOD_NOT_ALLOWED');
    expect(res.headers.allow).toBe('GET');
  });

  test('406 when Accept excludes JSON', async () => {
    const res = await request(app).get('/provinces').set('Accept', 'text/html');
    expectErrorContract(res, 406, 'NOT_ACCEPTABLE');
  });

  test('413 oversized body', async () => {
    const res = await request(app).post('/installations').send({ pad: 'x'.repeat(20000) });
    expectErrorContract(res, 413, 'PAYLOAD_TOO_LARGE');
  });

  test('415 wrong content type', async () => {
    const res = await request(app)
      .post('/installations')
      .set('Content-Type', 'text/plain')
      .send('hello');
    expectErrorContract(res, 415, 'UNSUPPORTED_MEDIA_TYPE');
  });

  test('412 stale If-Match', async () => {
    const list = await request(app).get('/installations?limit=1');
    const id = list.body.data[0].id;
    const res = await request(app)
      .patch(`/installations/${id}`)
      .set('If-Match', '"stale"')
      .send({ status: 'active' });
    expectErrorContract(res, 412, 'PRECONDITION_FAILED');
  });
});