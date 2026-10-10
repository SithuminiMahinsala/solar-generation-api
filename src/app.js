const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const requireJson = require('./middleware/requireJson');
const requireJsonContentType = require('./middleware/requireJsonContentType');
const { globalLimiter, tokenLimiter } = require('./middleware/rateLimit');
const { authenticate } = require('./middleware/auth');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({ exposedHeaders: ['ETag', 'Last-Modified', 'Location', 'Allow', 'Retry-After'] })
);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

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
app.use(errorHandler);

module.exports = app;