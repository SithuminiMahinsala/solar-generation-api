const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const requireJson = require('./middleware/requireJson');
const requireJsonContentType = require('./middleware/requireJsonContentType');
const { globalLimiter, tokenLimiter } = require('./middleware/rateLimit');
const { authenticate } = require('./middleware/auth');

const app = express();

app.set('trust proxy', 1); // req.protocol is "https" behind Render/Railway

// Helmet's default CSP adds "upgrade-insecure-requests", which can break Swagger UI's assets
// over plain http://localhost. Keep it in production, where HTTPS is real.
const csp = helmet.contentSecurityPolicy.getDefaultDirectives();
csp['upgrade-insecure-requests'] = process.env.NODE_ENV === 'production' ? [] : null;
app.use(helmet({ contentSecurityPolicy: { directives: csp } }));

app.use(
  cors({ exposedHeaders: ['ETag', 'Last-Modified', 'Location', 'Allow', 'Retry-After'] })
);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Public documentation (no token needed to read it; every call inside it needs one)
const spec = YAML.load(path.join(__dirname, 'docs', 'openapi.yaml'));
app.get('/', (req, res) => res.redirect('/api-docs'));
app.get('/openapi.json', (req, res) => res.json(spec));
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(spec, {
    customSiteTitle: 'SLSEA Solar API',
    swaggerOptions: { persistAuthorization: true },
  })
);

app.use(globalLimiter);
app.use(express.json({ limit: '10kb' }));
app.use(requireJsonContentType);

const RESOURCES = ['/provinces', '/districts', '/substations', '/installations'];
app.use(['/tokens', ...RESOURCES], requireJson);

// Public: obtaining a token
app.use('/tokens', tokenLimiter, require('./routes/tokens.routes'));

// Everything below requires a valid bearer token
app.use(RESOURCES, authenticate);

app.use('/provinces', require('./routes/provinces.routes'));
app.use('/districts', require('./routes/districts.routes'));
app.use('/substations', require('./routes/substations.routes'));
app.use('/installations', require('./routes/installations.routes'));

app.use(notFoundHandler);
app.use(errorHandler); // must be last

module.exports = app;