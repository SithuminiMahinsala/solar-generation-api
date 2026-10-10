// Usage (PowerShell):
//   $env:BASE_URL="https://YOUR-APP.onrender.com"; $env:SMOKE_PASSWORD="your seed password"; node scripts/smoke.js
const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
const PW = process.env.SMOKE_PASSWORD;
if (!BASE || !PW) {
  console.error('Set BASE_URL and SMOKE_PASSWORD first');
  process.exit(1);
}

let passed = 0;
let failed = 0;
function check(name, ok, extra = '') {
  ok ? passed++ : failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `   (${extra})`}`);
}

async function call(method, path, { token, body, headers = {} } = {}) {
  const h = { Accept: 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* empty or non-JSON body */ }
  return { status: res.status, headers: res.headers, text, json };
}

const isErrorBody = (j) => !!j && Object.keys(j).sort().join() === 'code,details,message';
const login = (creds) => call('POST', '/tokens', { body: creds });

(async () => {
  console.log(`Smoke test against ${BASE} (the first call may take ~1 minute if the service was asleep)\n`);

  // Basics
  const health = await call('GET', '/health');
  check('health is 200', health.status === 200, health.status);
  check('docs page is served', (await call('GET', '/api-docs/')).status === 200);
  check('raw OpenAPI spec is served', (await call('GET', '/openapi.json')).json?.openapi?.startsWith('3'));

  // Authentication
  const noToken = await call('GET', '/provinces');
  check('no token gives 401 in the error schema', noToken.status === 401 && isErrorBody(noToken.json));
  const bad = await login({ email: 'admin@slsea.lk', password: 'wrong-password' });
  check('wrong password gives 401', bad.status === 401, bad.status);

  const adminRes = await login({ email: 'admin@slsea.lk', password: PW });
  check('admin login is 200', adminRes.status === 200, adminRes.status);
  if (adminRes.status !== 200) return finish();
  const admin = adminRes.json.access_token;

  // Hierarchy and conditional GET
  const provinces = await call('GET', '/provinces', { token: admin });
  check('9 provinces', provinces.json?.total === 9, provinces.json?.total);
  const etag = provinces.headers.get('etag');
  check('ETag and Last-Modified present', !!etag && !!provinces.headers.get('last-modified'));
  const cond = await call('GET', '/provinces', {
  token: admin,
  headers: { 'If-None-Match': etag, 'Cache-Control': 'max-age=0' },
});
  check('If-None-Match gives 304 with empty body', cond.status === 304 && cond.text === '', cond.status);

  // Pagination, https links
  const page = await call('GET', '/installations?limit=5', { token: admin });
  check('240 installations, 5 per page', page.json?.total === 240 && page.json?.data?.length === 5);
  check('links are https', page.json?.links?.next?.startsWith('https://'), page.json?.links?.next);
  const inst = page.json.data[0];
  check('no secrets in installation', !/deviceSecret|passwordHash/.test(page.text));

  // Readings: pagination, sorting, window, last-reading, composite
  const readings = await call('GET', `/installations/${inst.id}/readings?limit=100`, { token: admin });
  check('672+ readings, 100 returned', readings.json?.total >= 672 && readings.json?.data?.length === 100, readings.json?.total);
  const asc = await call('GET', `/installations/${inst.id}/readings?sort=timestamp&limit=2`, { token: admin });
  const desc = await call('GET', `/installations/${inst.id}/readings?sort=-timestamp&limit=2`, { token: admin });
  check('sort asc and desc differ correctly',
    new Date(asc.json.data[0].timestamp) < new Date(desc.json.data[0].timestamp));
  const last = await call('GET', `/installations/${inst.id}/last-reading`, { token: admin });
  check('last-reading is the newest reading', last.json?.id === desc.json.data[0].id);
  const to = new Date(last.json.timestamp);
  const from = new Date(to.getTime() - 3600 * 1000);
  const win = await call('GET',
    `/installations/${inst.id}/readings?from=${from.toISOString()}&to=${to.toISOString()}`, { token: admin });
  check('time window filter returns rows', win.json?.total > 0, win.json?.total);
  const rev = await call('GET', `/installations/${inst.id}/readings?from=2026-10-10&to=2026-10-01`, { token: admin });
  check('reversed window gives 400', rev.status === 400 && isErrorBody(rev.json));
  const detail = await call('GET', `/installations/${inst.id}/detail`, { token: admin });
  check('composite has substation, district, province, lastReading',
    !!detail.json?.substation && !!detail.json?.district && !!detail.json?.province && !!detail.json?.lastReading);

  // Error handling
  check('unknown id gives 404', (await call('GET', '/installations/000000000000000000000000', { token: admin })).status === 404);
  check('malformed id gives 400', (await call('GET', '/installations/abc', { token: admin })).status === 400);
  const m405 = await call('DELETE', '/provinces', { token: admin });
  check('wrong method gives 405 with Allow', m405.status === 405 && m405.headers.get('allow') === 'GET', m405.status);
  const m406 = await call('GET', '/provinces', { token: admin, headers: { Accept: 'text/html' } });
  check('Accept text/html gives 406', m406.status === 406, m406.status);

  // Jurisdiction
  const provList = provinces.json.data;
  const central = provList.find((p) => p.name === 'Central');
  const kandy = (await call('GET', `/provinces/${central.id}/districts`, { token: admin }))
    .json.data.find((d) => d.name === 'Kandy');
  const colomboLogin = await login({ email: 'colombo.district@slsea.lk', password: PW });
  const colombo = colomboLogin.json.access_token;
  const colomboId = colomboLogin.json.jurisdiction.id;
  check('own district summary is 200',
    (await call('GET', `/districts/${colomboId}/generation-summary`, { token: colombo })).status === 200);
  check('other district is 403', (await call('GET', `/districts/${kandy.id}`, { token: colombo })).status === 403);
  check('other district readings is 403', (await call('GET', `/districts/${kandy.id}/readings`, { token: colombo })).status === 403);
  const bypass = await call('GET', `/installations?district=${kandy.id}`, { token: colombo });
  check('filter cannot widen scope (total 0)', bypass.status === 200 && bypass.json.total === 0);

  const summary = await call('GET', `/districts/${colomboId}/generation-summary`, { token: admin });
  check('summary has numbers', typeof summary.json?.currentPowerKw === 'number' && summary.json?.installations?.total > 0);

  // Write path: create a temporary installation, act as its device, clean up
  const meterId = `SMOKE-${Date.now()}`;
  const created = await call('POST', '/installations', {
    token: admin,
    body: { name: 'Smoke Test Rooftop', meterId, capacityKw: 5, installDate: '2026-01-01', substationId: inst.substationId },
  });
  check('create installation gives 201 with Location', created.status === 201 && !!created.headers.get('location'), created.status);
  if (created.status === 201) {
    const { id, deviceSecret } = created.json;
    try {
      const dev = await login({ meterId, deviceSecret });
      check('device login is 200', dev.status === 200, dev.status);
      const body = { timestamp: new Date(Date.now() - 60000).toISOString(), powerKw: 1, energyKwh: 10, voltage: 230 };
      const post = await call('POST', `/installations/${id}/readings`, { token: dev.json.access_token, body });
      check('device POST reading gives 201 with Location', post.status === 201 && !!post.headers.get('location'), post.status);
      const dup = await call('POST', `/installations/${id}/readings`, { token: dev.json.access_token, body });
      check('duplicate reading gives 409', dup.status === 409, dup.status);
      const other = await call('POST', `/installations/${inst.id}/readings`, { token: dev.json.access_token, body });
      check('device cannot write to another installation (403)', other.status === 403, other.status);
      check('device cannot read (403)', (await call('GET', '/provinces', { token: dev.json.access_token })).status === 403);
      const put = await call('PUT', `/installations/${id}/readings/${post.json.id}`, { token: admin, body: {} });
      check('PUT on a reading gives 405', put.status === 405, put.status);
      check('delete reading gives 204', (await call('DELETE', `/installations/${id}/readings/${post.json.id}`, { token: admin })).status === 204);

      const patched = await call('PATCH', `/installations/${id}`, { token: admin, body: { status: 'maintenance' } });
      check('PATCH gives 200', patched.status === 200, patched.status);
      const stale = await call('PATCH', `/installations/${id}`, { token: admin, headers: { 'If-Match': '"stale"' }, body: { status: 'active' } });
      check('stale If-Match gives 412', stale.status === 412, stale.status);
    } finally {
      const del = await call('DELETE', `/installations/${id}`, { token: admin });
      check('cleanup: delete test installation gives 204', del.status === 204, del.status);
    }
  }
  finish();
})().catch((e) => {
  console.error('Smoke test crashed:', e);
  process.exit(1);
});

function finish() {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}