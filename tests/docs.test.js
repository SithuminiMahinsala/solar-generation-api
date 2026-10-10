require('dotenv').config({ quiet: true });
const request = require('supertest');
const SwaggerParser = require('@apidevtools/swagger-parser');
const path = require('path');
const app = require('../src/app');
const routeTable = require('../src/utils/routeTable');

const specPath = path.join(__dirname, '..', 'src', 'docs', 'openapi.yaml');

describe('OpenAPI documentation', () => {
  test('spec is valid OpenAPI 3', async () => {
    const api = await SwaggerParser.validate(specPath);
    expect(api.openapi).toMatch(/^3\./);
  });

  test('swagger UI and the raw spec are served without a token', async () => {
    const ui = await request(app).get('/api-docs/').redirects(1);
    expect(ui.status).toBe(200);
    expect(ui.text).toMatch(/swagger/i);

    const raw = await request(app).get('/openapi.json');
    expect(raw.status).toBe(200);
    expect(raw.body.paths['/tokens']).toBeDefined();
  });

  test('every routable method in the route table is documented', async () => {
    const api = await SwaggerParser.dereference(specPath);
    const missing = [];

    for (const [pattern, methods] of routeTable) {
      // turn the regex back into an OpenAPI path, e.g. /installations/{installationId}
      const documented = Object.keys(api.paths).find((p) => {
        const asRegex = new RegExp(
          '^' + p.replace(/\{[^}]+\}/g, '[^/]+') + '/?$'
        );
        return asRegex.test(sample(pattern));
      });
      if (!documented) {
        missing.push(`${pattern} (no path documented)`);
        continue;
      }
      methods.forEach((m) => {
        if (!api.paths[documented][m.toLowerCase()]) missing.push(`${m} ${documented}`);
      });
    }
    expect(missing).toEqual([]);
  });
});

// Build a concrete URL that matches a route-table pattern
function sample(pattern) {
  return pattern.source
    .replace(/\\\//g, '/')
    .replace(/\[\^\/\]\+/g, 'abc')
    .replace(/\/\?\$$/, '')
    .replace(/^\^/, '');
}