const request = require('supertest');
const app = require('../src/app');

async function login(credentials) {
  const res = await request(app).post('/tokens').send(credentials);
  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

const PASSWORD = () => process.env.SEED_USER_PASSWORD;
const adminToken = async () =>
  (await login({ email: 'admin@slsea.lk', password: PASSWORD() })).access_token;

module.exports = { login, adminToken, PASSWORD };